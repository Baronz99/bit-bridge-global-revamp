# frozen_string_literal: true

module ServiceAvailability
  class SnapshotBuilder
    PROVIDER = 'buypower'
    WINDOW_MINUTES = 15
    STALE_AFTER_SECONDS = 180
    PERSISTED_FRESHNESS_SECONDS = 600

    def initialize(now: Time.current)
      @now = now
    end

    def call
      service_rows = build_service_rows

      {
        generated_at: @now.iso8601,
        stale_after_seconds: STALE_AFTER_SECONDS,
        global: build_global_state(service_rows),
        services: service_rows
      }
    end

    private

    def build_service_rows
      grouped_orders = recent_orders.group_by { |order| service_key(order) }
      persisted_statuses = fresh_persisted_statuses
      keys = (grouped_orders.keys + persisted_statuses.keys).uniq

      keys.filter_map do |key|
        orders = grouped_orders[key] || []
        persisted = persisted_statuses[key]

        if persisted.present?
          build_persisted_row(key: key, orders: orders, persisted: persisted)
        elsif orders.any?
          build_inferred_row(key: key, orders: orders)
        end
      end.sort_by { |row| row[:label] }
    end

    def build_persisted_row(key:, orders:, persisted:)
      state = internal_state_from_provider_state(persisted.state)

      {
        key: key,
        label: service_label(orders.first, key),
        state: state,
        confidence: confidence_for(persisted.sample_size),
        reliability_percent: persisted.reliability_percent,
        last_updated_at: persisted.window_ended_at&.iso8601 || persisted.updated_at&.iso8601,
        source: {
          provider_signal: persisted.state,
          internal_signal: state
        },
        metrics: {
          window_minutes: ((persisted.window_ended_at - persisted.window_started_at) / 60).round,
          attempts: persisted.sample_size,
          success_rate: (persisted.reliability_percent.to_f / 100.0).round(4),
          timeout_rate: nil,
          p95_latency_ms: persisted.avg_latency_ms
        },
        advice: {
          can_checkout: state != 'outage',
          message: advice_message(state)
        }
      }
    end

    def build_inferred_row(key:, orders:)
      attempts = orders.size
      completed_count = orders.count { |order| order.status == 'completed' }
      timedout_count = orders.count { |order| order.status == 'timedout' }
      success_rate = ratio(completed_count, attempts)
      timeout_rate = ratio(timedout_count, attempts)
      p95_latency_ms = percentile_95(latencies_ms(orders))
      last_updated_at = orders.map(&:updated_at).compact.max
      confidence = confidence_for(attempts)
      stale = stale?(last_updated_at)

      state = classify_state(
        attempts: attempts,
        success_rate: success_rate,
        timeout_rate: timeout_rate,
        p95_latency_ms: p95_latency_ms,
        confidence: confidence,
        stale: stale
      )

      {
        key: key,
        label: service_label(orders.first, key),
        state: state,
        confidence: confidence,
        reliability_percent: (success_rate * 100).round,
        last_updated_at: last_updated_at&.iso8601,
        source: {
          provider_signal: 'unknown',
          internal_signal: state
        },
        metrics: {
          window_minutes: WINDOW_MINUTES,
          attempts: attempts,
          success_rate: success_rate,
          timeout_rate: timeout_rate,
          p95_latency_ms: p95_latency_ms
        },
        advice: {
          can_checkout: state != 'outage',
          message: advice_message(state)
        }
      }
    end

    def build_global_state(rows)
      considered = rows.reject { |row| row[:state] == 'unknown' }
      state =
        if considered.any? { |row| row[:state] == 'outage' }
          'outage'
        elsif considered.any? { |row| row[:state] == 'degraded' }
          'degraded'
        elsif considered.any? { |row| row[:state] == 'operational' }
          'operational'
        else
          'unknown'
        end

      {
        state: state,
        confidence: global_confidence(rows),
        reason: global_reason(state)
      }
    end

    def recent_orders
      BillOrder.unscoped
               .where(created_at: window_start..@now)
               .where.not(service_type: [nil, ''])
    end

    def fresh_persisted_statuses
      ProviderServiceStatus
        .where(provider: PROVIDER)
        .where('updated_at >= ?', @now - PERSISTED_FRESHNESS_SECONDS.seconds)
        .index_by(&:service_key)
    end

    def window_start
      @now - WINDOW_MINUTES.minutes
    end

    def service_key(order)
      service_type = order.service_type.to_s.strip.upcase
      biller = order.biller.to_s.strip.upcase.gsub(/\s+/, '_')
      return service_type if biller.empty?

      "#{biller}_#{service_type}"
    end

    def service_label(order, key)
      return service_label_from_order(order) if order.present?

      service_label_from_key(key)
    end

    def service_label_from_order(order)
      service_type = order.service_type.to_s.strip.upcase
      biller = order.biller.to_s.strip.upcase
      return service_type if biller.empty?

      "#{biller} (#{service_type})"
    end

    def service_label_from_key(key)
      parts = key.to_s.split('_')
      return key.to_s if parts.empty?

      service_type = parts.pop.to_s.upcase
      biller = parts.join('_').to_s.upcase
      return service_type if biller.empty?

      "#{biller} (#{service_type})"
    end

    def ratio(numerator, denominator)
      return 0.0 if denominator.to_i <= 0

      (numerator.to_f / denominator.to_f).round(4)
    end

    def latencies_ms(orders)
      orders.filter_map do |order|
        next if order.created_at.blank? || order.updated_at.blank?

        ((order.updated_at - order.created_at) * 1000).round
      end
    end

    def percentile_95(values)
      return nil if values.empty?

      sorted = values.sort
      index = (0.95 * (sorted.length - 1)).ceil
      sorted[index]
    end

    def confidence_for(attempts)
      return 'high' if attempts >= 20
      return 'medium' if attempts >= 8
      return 'low' if attempts.positive?

      'low'
    end

    def stale?(last_updated_at)
      return true if last_updated_at.blank?

      (@now - last_updated_at) > STALE_AFTER_SECONDS
    end

    def classify_state(attempts:, success_rate:, timeout_rate:, p95_latency_ms:, confidence:, stale:)
      return 'unknown' if attempts <= 0
      return 'unknown' if stale
      return 'unknown' if confidence == 'low'
      return 'outage' if success_rate < 0.5 || timeout_rate > 0.25
      return 'degraded' if success_rate < 0.9
      return 'degraded' if p95_latency_ms && p95_latency_ms > 6000

      'operational'
    end

    def internal_state_from_provider_state(provider_state)
      case provider_state.to_s
      when 'available' then 'operational'
      when 'unstable' then 'degraded'
      when 'down' then 'outage'
      else 'unknown'
      end
    end

    def advice_message(state)
      case state
      when 'operational'
        'Service is operating normally.'
      when 'degraded'
        'Performance issues detected. Transaction may be delayed.'
      when 'outage'
        'Service temporarily unavailable. Please try again later.'
      else
        'Status currently unavailable. You can still try.'
      end
    end

    def global_confidence(rows)
      return 'high' if rows.count { |row| row[:confidence] == 'high' } >= 3
      return 'medium' if rows.count { |row| %w[high medium].include?(row[:confidence]) } >= 1

      'low'
    end

    def global_reason(state)
      case state
      when 'operational'
        'Most services are performing within normal thresholds.'
      when 'degraded'
        'Some services are experiencing elevated failures or latency.'
      when 'outage'
        'One or more services are currently unavailable.'
      else
        'Insufficient or stale data for a reliable status signal.'
      end
    end
  end
end