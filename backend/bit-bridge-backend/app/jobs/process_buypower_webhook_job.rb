# frozen_string_literal: true

class ProcessBuypowerWebhookJob < ApplicationJob
  queue_as :default

  def perform(webhook_event_id)
    WebhookEvent.reset_column_information
    event = WebhookEvent.find_by(id: webhook_event_id)
    return unless event
    return if event.processed_at.present?

    payload = event.payload.is_a?(String) ? safe_parse(event.payload) : event.payload || {}
    reference = extract_reference(payload)
    bill_order = find_bill_order(reference)

    Rails.logger.info(
      "[BuyPowerWebhook] start event_id=#{event.id} event_type=#{event.event_type.inspect} reference=#{reference.inspect} bill_order_id=#{bill_order&.id}"
    )

    unless bill_order
      event.update(processed_at: Time.current, processing_error: "BillOrder not found for reference=#{reference.inspect}")
      return
    end

    data = payload.is_a?(Hash) ? (payload['data'] || payload[:data] || {}) : {}
    provider_response = payload
    provider_reference = resolve_provider_reference(data, payload, reference, bill_order.provider_reference)
    response_code = data.is_a?(Hash) ? (data['responseCode'] || data[:responseCode]) : nil
    status_flag = data.is_a?(Hash) ? (data['status'] || data[:status]) : nil
    message = payload['message'] || payload.dig('data', 'message') || 'Webhook update'
    token = data.is_a?(Hash) ? (data['token'] || data[:token]) : nil
    units = data.is_a?(Hash) ? (data['units'] || data[:units]) : nil
    provider_txn_id =
      if data.is_a?(Hash)
        data['id'] || data[:id] || data['transactionId'] || data[:transactionId] || data['transaction_id'] || data[:transaction_id]
      end

    status_normalized = status_flag.to_s.downcase
    electricity_order = bill_order.service_type.to_s.strip.upcase == 'ELECTRICITY'

    success =
      response_code.to_i == 100 ||
      status_flag == true ||
      %w[success completed].include?(status_normalized)

    failure =
      status_flag == false ||
      status_normalized == 'false' ||
      (response_code.present? && ![0, 100, 200].include?(response_code.to_i)) ||
      %w[failed reversed cancelled refund refunded].include?(status_normalized)

    if bill_order.completed?
      if electricity_order && bill_order.token.to_s.strip.blank? && token.to_s.strip.present?
        bill_order.update(
          token: token,
          units: units,
          transaction_id: provider_txn_id.presence || bill_order.transaction_id,
          provider_response: provider_response
        )
      elsif provider_response.present?
        bill_order.update(provider_response: provider_response)
      end
      event.update(processed_at: Time.current)
      return
    end

    if success
      old_status = bill_order.status
      new_status = electricity_order && token.to_s.strip.blank? ? 'processing' : 'completed'
      log_pre_update(bill_order.id, old_status, new_status, provider_reference, response_code, status_flag)

      attrs = {
        status: BillOrder.statuses[new_status],
        provider_reference: provider_reference || provider_txn_id || bill_order.provider_reference,
        provider_response: provider_response,
        transaction_id: provider_txn_id || bill_order.transaction_id,
        units: units || bill_order.units,
        token: token || bill_order.token,
        reason: (new_status == 'processing' ? 'Payment confirmed. Token delivery is in progress.' : nil),
        updated_at: Time.current
      }

      if BillOrder::TERMINAL_STATUSES.include?(bill_order.status)
        bill_order.update_columns(attrs)
        bill_order.reload
      else
        bill_order.update(attrs)
      end

      BillOrders::Finalizer.call(bill_order: bill_order) if bill_order.status.to_s == 'completed'
      BuyPowerReconcileJob.set(wait: 15.seconds).perform_later(bill_order.id) if new_status == 'processing'

      log_post_update(bill_order.id, old_status, new_status, provider_reference, response_code, status_flag)
    elsif failure
      old_status = bill_order.status
      new_status = 'failed'
      log_pre_update(bill_order.id, old_status, new_status, provider_reference, response_code, status_flag)

      bill_order.update(
        status: 'failed',
        provider_reference: provider_reference,
        provider_response: provider_response,
        reason: message
      )

      log_post_update(bill_order.id, old_status, new_status, provider_reference, response_code, status_flag)
    else
      old_status = bill_order.status
      new_status = 'processing'
      log_pre_update(bill_order.id, old_status, new_status, provider_reference, response_code, status_flag)

      bill_order.update(
        status: 'processing',
        provider_reference: provider_reference,
        provider_response: provider_response,
        reason: 'Awaiting provider completion'
      )

      log_post_update(bill_order.id, old_status, new_status, provider_reference, response_code, status_flag)
    end

    event.update(processed_at: Time.current)
  rescue StandardError => e
    event.update(processing_error: e.message, processed_at: Time.current) if event
    Rails.logger.error("[ProcessBuypowerWebhookJob] error event_id=#{webhook_event_id} #{e.class}: #{e.message}")
  end

  private

  def safe_parse(json_string)
    JSON.parse(json_string)
  rescue JSON::ParserError
    {}
  end

  def extract_reference(payload)
    payload['orderId'] ||
      payload[:orderId] ||
      payload['order_id'] ||
      payload[:order_id] ||
      payload['reference'] ||
      payload[:reference] ||
      payload['transactionRef'] ||
      payload[:transactionRef] ||
      payload.dig('data', 'orderId') ||
      payload.dig(:data, :orderId)
  end

  def find_bill_order(ref)
    return nil if ref.blank?

    if ref.to_s.match?(/\A[0-9a-fA-F-]{36}\z/)
      found = BillOrder.find_by(id: ref)
      return found if found
    end

    BillOrder.find_by(provider_reference: ref) ||
      BillOrder.find_by(idempotency_key: ref)
  end

  def resolve_provider_reference(data, payload, _fallback_ref, existing_ref)
    candidates = []
    if data.is_a?(Hash)
      candidates += [
        data['transactionId'] || data[:transactionId],
        data['transaction_id'] || data[:transaction_id],
        data['reference'] || data[:reference],
        data['ref'] || data[:ref]
      ]
    end

    candidates << existing_ref

    candidates.find { |val| val.present? }
  end

  def log_pre_update(bill_order_id, old_status, new_status, provider_reference, response_code, status_flag)
    Rails.logger.info(
      "[BuyPowerWebhook] update start bill_order_id=#{bill_order_id} old_status=#{old_status} new_status=#{new_status} provider_reference=#{provider_reference.inspect} responseCode=#{response_code.inspect} status_flag=#{status_flag.inspect}"
    )
  end

  def log_post_update(bill_order_id, old_status, new_status, provider_reference, response_code, status_flag)
    Rails.logger.info(
      "[BuyPowerWebhook] update done bill_order_id=#{bill_order_id} old_status=#{old_status} new_status=#{new_status} provider_reference=#{provider_reference.inspect} responseCode=#{response_code.inspect} status_flag=#{status_flag.inspect}"
    )
  end
end
