# frozen_string_literal: true

class SendOrderReceiptJob < ApplicationJob
  queue_as :default

  RETRY_WAIT = 30.seconds

  retry_on StandardError, wait: RETRY_WAIT, attempts: 3

  def perform(order_id)
    order = BillOrder.find_by(id: order_id)
    return if order.nil?
    return if order.email.blank?
    return unless BillOrder::RECEIPT_EMAIL_STATUSES.include?(order.status.to_s)

    order.with_lock do
      meta = provider_payload(order)
      receipt_meta = meta['receipt_email'].is_a?(Hash) ? meta['receipt_email'] : {}
      return if receipt_meta['status'] == 'sent'

      attempts = receipt_meta['attempts'].to_i + 1
      now = Time.current.utc.iso8601

      receipt_meta['attempts'] = attempts
      receipt_meta['last_attempt_at'] = now
      meta['receipt_email'] = receipt_meta
      order.update_columns(provider_response: meta, updated_at: Time.current)
    end

    OrderMailer.purchase_confirmation(order).deliver_now

    mark_sent(order)
  rescue StandardError => e
    mark_failed(order, e) if order.present?
    raise e
  end

  private

  def mark_sent(order)
    order.with_lock do
      meta = provider_payload(order)
      receipt_meta = meta['receipt_email'].is_a?(Hash) ? meta['receipt_email'] : {}
      now = Time.current.utc.iso8601

      receipt_meta['status'] = 'sent'
      receipt_meta['sent_at'] = now
      receipt_meta['last_error'] = nil
      meta['receipt_email'] = receipt_meta

      order.update_columns(provider_response: meta, updated_at: Time.current)
    end
  end

  def mark_failed(order, error)
    order.with_lock do
      meta = provider_payload(order)
      receipt_meta = meta['receipt_email'].is_a?(Hash) ? meta['receipt_email'] : {}

      receipt_meta['status'] = 'failed'
      receipt_meta['last_error'] = "#{error.class}: #{error.message}".truncate(300)
      meta['receipt_email'] = receipt_meta

      order.update_columns(provider_response: meta, updated_at: Time.current)
    end
  end

  def provider_payload(order)
    raw = order.provider_response
    return raw if raw.is_a?(Hash)
    return {} if raw.blank?

    JSON.parse(raw)
  rescue StandardError
    {}
  end
end
