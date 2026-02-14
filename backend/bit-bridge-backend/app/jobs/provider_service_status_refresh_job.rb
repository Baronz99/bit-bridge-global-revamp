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
    window_ended_at = now
    window_started_at = now - WINDOW_MINUTES.minutes

    grouped_orders(window_started_at, window_ended_at).each do |service_key, orders|
      upsert_rows << build_row(
        service_key: service_key,
        orders: orders,
        window_started_at: window_started_at,
        window_ended_at: window_ended_at
      )
    end

    ProviderServiceStatus.upsert_all(
      upsert_rows,
      unique_by: :index_provider_service_statuses_on_provider_and_service_key
    ) if upsert_rows.any?

    {
      provider: PROVIDER,
      window_started_at: window_started_at,
      window_ended_at: window_ended_at,
      refreshed: upsert_rows.size
    }
  end

  private

  def upsert_rows
    @upsert_rows ||= []
  end

  def grouped_orders(window_started_at, window_ended_at)
    BillOrder.unscoped
             .where(created_at: window_started_at..window_ended_at)
             .where.not(service_type: [nil, ''])
             .group_by { |order| service_key(order) }
  end

  def service_key(order)
    service_type = order.service_type.to_s.strip.upcase
    biller = order.biller.to_s.strip.upcase.gsub(/\s+/, '_')
    return service_type if biller.empty?

    "#{biller}_#{service_type}"
  end

  def build_row(service_key:, orders:, window_started_at:, window_ended_at:)
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

    avg_latency_ms = begin
      values = orders.filter_map { |order| latency_ms(order) }
      values.any? ? (values.sum.to_f / values.size).round : nil
    end

    last_error = extract_last_error(samples)

    {
      provider: PROVIDER,
      service_key: service_key,
      state: classify_state(sample_size: sample_size, reliability_percent: reliability_percent, timeout_rate: timeout_rate),
      reliability_percent: reliability_percent,
      sample_size: sample_size,
      window_started_at: window_started_at,
      window_ended_at: window_ended_at,
      avg_latency_ms: avg_latency_ms,
      last_error: last_error,
      created_at: Time.current,
      updated_at: Time.current
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
end
