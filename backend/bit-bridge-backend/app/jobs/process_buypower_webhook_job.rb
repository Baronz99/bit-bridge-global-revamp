# frozen_string_literal: true

class ProcessBuypowerWebhookJob < ApplicationJob
  queue_as :default

  def perform(webhook_event_id)
    WebhookEvent.reset_column_information
    event = WebhookEvent.find_by(id: webhook_event_id)
    return unless event

    payload = event.payload.is_a?(String) ? safe_parse(event.payload) : event.payload || {}
    reference = extract_reference(payload)
    bill_order = find_bill_order(reference)

    unless bill_order
      event.update(processed_at: Time.current, processing_error: "BillOrder not found for reference=#{reference.inspect}")
      return
    end

    event_type = payload['event'] || payload[:event]
    provider_response = payload
    provider_reference = payload.dig('data', 'id') || payload['id'] || reference
    response_code = payload.dig('data', 'responseCode') || payload['responseCode']
    status_flag = payload['status'] || payload.dig('data', 'status')
    message = payload['message'] || payload.dig('data', 'message') || 'Webhook update'

    success =
      response_code.to_i == 100 ||
      status_flag.to_s.downcase == 'true' ||
      %w[completed success].include?(status_flag.to_s.downcase) ||
      event_type.to_s.downcase.include?('success')

    failure =
      (!success && response_code.present?) ||
      %w[failed reversed cancelled refund refunded].include?(status_flag.to_s.downcase)

    if bill_order.completed?
      bill_order.update(provider_response: provider_response) if provider_response.present?
      event.update(processed_at: Time.current)
      return
    end

    if success
      bill_order.update(
        status: 'completed',
        provider_reference: provider_reference,
        provider_response: provider_response,
        reason: message
      )
    elsif failure
      bill_order.update(
        status: 'failed',
        provider_reference: provider_reference,
        provider_response: provider_response,
        reason: message
      )
    else
      bill_order.update(
        status: 'processing',
        provider_reference: provider_reference,
        provider_response: provider_response,
        reason: 'Awaiting provider completion'
      )
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
end
