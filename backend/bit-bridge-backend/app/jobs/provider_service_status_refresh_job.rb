# frozen_string_literal: true

class ProviderServiceStatusRefreshJob < ApplicationJob
  queue_as :default

  PROVIDER = 'buypower'
  WINDOW_MINUTES = 30
  MIN_SAMPLES = 10

  SUCCESS_STATUSES = %w[completed].freeze
  FAILURE_STATUSES = %w[failed declined].freeze
  TIMEOUT_STATUSES = %w[timedout].freeze

  def perform(now: Time.current)
    @now = now
    window_ended_at = @now
    window_started_at = @now - WINDOW_MINUTES.minutes

    grouped = grouped_orders(window_started_at, window_ended_at)
    provider_rows = fetch_provider_rows(window_started_at: window_started_at, window_ended_at: window_ended_at)
    keys = (grouped.keys + provider_rows.keys).uniq
    previous_rows = ProviderServiceStatus.where(provider: PROVIDER, service_key: keys).index_by(&:service_key)
    rows = []

    keys.each do |service_key|
      orders = grouped[service_key] || []
      if provider_rows.key?(service_key)
        rows << merge_provider_row(provider_rows[service_key], orders)
      elsif orders.any?
        rows << build_inferred_row(
          service_key: service_key,
          orders: orders,
          window_started_at: window_started_at,
          window_ended_at: window_ended_at
        )
      end
    end

    ProviderServiceStatus.upsert_all(
      rows,
      unique_by: :index_provider_service_statuses_on_provider_and_service_key
    ) if rows.any?

    Core::Notifications::ServiceStatusRecoveryPublisher.call(
      provider: PROVIDER,
      previous_rows: previous_rows,
      current_rows: rows,
      occurred_at: @now
    ) if rows.any?

    {
      provider: PROVIDER,
      window_started_at: window_started_at,
      window_ended_at: window_ended_at,
      refreshed: rows.size
    }
  end

  private

  def grouped_orders(window_started_at, window_ended_at)
    BillOrder.unscoped
             .where(created_at: window_started_at..window_ended_at)
             .where.not(service_type: [nil, ''])
             .group_by { |order| service_key(order) }
  end

  def fetch_provider_rows(window_started_at:, window_ended_at:)
    service = BuyPowerPaymentService.new
    response = service.reliability_index
    return {} unless response[:status] == 'success'

    extract_provider_items(response[:response]).each_with_object({}) do |item, rows|
      row = build_provider_row(item, window_started_at: window_started_at, window_ended_at: window_ended_at)
      rows[row[:service_key]] = row if row.present?
    end
  rescue StandardError => e
    Rails.logger.warn("[ProviderServiceStatusRefreshJob] BuyPower reliability fetch failed: #{e.class} #{e.message}")
    {}
  end

  def extract_provider_items(payload)
    return [] unless payload.is_a?(Hash)

    items = payload['data'] || payload[:data] || payload.dig('result', 'data') || payload.dig(:result, :data)
    return items if items.is_a?(Array)

    []
  end

  def build_provider_row(item, window_started_at:, window_ended_at:)
    return nil unless item.is_a?(Hash)

    vertical = normalize_vertical(value_of(item, 'vertical', 'service_type'))
    disco_code = normalize_provider_code(value_of(item, 'disco_code', 'provider_code', 'provider', 'disco'))
    return nil if vertical.blank? || disco_code.blank?

    success = clamp_percent(value_of(item, 'success_percentage', 'success_percent', 'success_rate', 'success'))
    failure = clamp_percent(value_of(item, 'failure_percentage', 'failure_percent', 'failure_rate', 'failure'))
    provider_online = boolean_or_nil(value_of(item, 'provider_online', 'online', 'is_online', 'providerOnline'))
    state = provider_state(provider_online: provider_online, success: success, failure: failure)
    sample_size = integer_or_nil(value_of(item, 'sample_size', 'sampleCount', 'count', 'transaction_count', 'total_transactions'))
    sample_size = MIN_SAMPLES if sample_size.to_i <= 0

    {
      provider: PROVIDER,
      service_key: "#{disco_code}_#{vertical}",
      state: state,
      reliability_percent: success.to_i,
      sample_size: sample_size,
      window_started_at: window_started_at,
      window_ended_at: window_ended_at,
      avg_latency_ms: nil,
      last_error: nil,
      created_at: @now,
      updated_at: @now
    }
  end

  def merge_provider_row(provider_row, orders)
    return provider_row if orders.blank?

    samples = orders.filter_map { |order| classify(order) }
    row = provider_row.dup
    row[:avg_latency_ms] = avg_latency_ms(orders)
    row[:last_error] = extract_last_error(samples)
    row[:sample_size] = [row[:sample_size].to_i, samples.size].max
    row
  end

  def service_key(order)
    service_type = order.service_type.to_s.strip.upcase
    biller = order.biller.to_s.strip.upcase.gsub(/\s+/, '_')
    return service_type if biller.empty?

    "#{biller}_#{service_type}"
  end

  def build_inferred_row(service_key:, orders:, window_started_at:, window_ended_at:)
    samples = orders.filter_map { |order| classify(order) }
    sample_size = samples.size
    success_count = samples.count { |sample| sample[:class] == :success }
    timeout_count = samples.count { |sample| sample[:class] == :timeout }

    reliability_percent =
      if sample_size.zero?
        0
      else
        ((success_count.to_f / sample_size) * 100).round
      end

    timeout_rate = sample_size.zero? ? 0.0 : (timeout_count.to_f / sample_size)

    last_error = extract_last_error(samples)

    {
      provider: PROVIDER,
      service_key: service_key,
      state: classify_state(sample_size: sample_size, reliability_percent: reliability_percent, timeout_rate: timeout_rate),
      reliability_percent: reliability_percent,
      sample_size: sample_size,
      window_started_at: window_started_at,
      window_ended_at: window_ended_at,
      avg_latency_ms: avg_latency_ms(orders),
      last_error: last_error,
      created_at: @now,
      updated_at: @now
    }
  end

  def classify(order)
    status = order.status.to_s
    klass =
      if SUCCESS_STATUSES.include?(status)
        :success
      elsif TIMEOUT_STATUSES.include?(status)
        :timeout
      elsif FAILURE_STATUSES.include?(status)
        :failure
      end
    return nil if klass.nil?

    {
      class: klass,
      updated_at: order.updated_at,
      reason: order.reason,
      provider_response: order.provider_response
    }
  end

  def classify_state(sample_size:, reliability_percent:, timeout_rate:)
    return 'unknown' if sample_size < MIN_SAMPLES
    return 'down' if reliability_percent < 50
    return 'down' if timeout_rate > 0.25
    return 'unstable' if reliability_percent < 90

    'available'
  end

  def provider_state(provider_online:, success:, failure:)
    return 'down' if provider_online == false
    return 'down' if success.to_i <= 0 && failure.to_i >= 100
    return 'unstable' if success.to_i < 90
    return 'available' if provider_online == true

    'unknown'
  end

  def avg_latency_ms(orders)
    values = orders.filter_map { |order| latency_ms(order) }
    values.any? ? (values.sum.to_f / values.size).round : nil
  end

  def latency_ms(order)
    return nil if order.created_at.blank? || order.updated_at.blank?

    ((order.updated_at - order.created_at) * 1000).round
  end

  def extract_last_error(samples)
    failed = samples.select { |sample| %i[failure timeout].include?(sample[:class]) }
    return nil if failed.empty?

    recent = failed.max_by { |sample| sample[:updated_at] || Time.at(0) }
    reason = recent[:reason].to_s.strip
    return reason if reason.present?

    payload = recent[:provider_response]
    return payload.to_json if payload.is_a?(Hash)

    payload.to_s.presence
  end

  def value_of(hash, *keys)
    keys.each do |key|
      return hash[key] if hash.key?(key)
      sym = key.to_sym
      return hash[sym] if hash.key?(sym)
    end
    nil
  end

  def normalize_vertical(raw)
    vertical = raw.to_s.strip.upcase
    return nil if vertical.blank?

    return 'TV' if %w[CABLE CABLETV CABLE_TV].include?(vertical)

    vertical
  end

  def normalize_provider_code(raw)
    code = raw.to_s.strip.upcase.gsub(/\s+/, '_')
    code.presence
  end

  def clamp_percent(raw)
    return 0 if raw.nil?

    value = raw.to_f.round
    return 0 if value.negative?
    return 100 if value > 100

    value
  end

  def integer_or_nil(raw)
    Integer(raw)
  rescue ArgumentError, TypeError
    nil
  end

  def boolean_or_nil(raw)
    return true if raw == true
    return false if raw == false

    normalized = raw.to_s.strip.downcase
    return true if %w[true 1 yes online up available].include?(normalized)
    return false if %w[false 0 no offline down unavailable].include?(normalized)

    nil
  end
end
