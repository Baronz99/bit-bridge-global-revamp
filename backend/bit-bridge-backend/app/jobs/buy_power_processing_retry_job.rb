# frozen_string_literal: true

class BuyPowerProcessingRetryJob < ApplicationJob
  queue_as :default

  def perform(bill_order_id)
    order = BillOrder.find_by(id: bill_order_id)
    return unless order
    return unless order.processing?
    return if anchor_transfer_shadow_order?(order)

    BuyPowerReconcileJob.perform_later(order.id)
  rescue StandardError => e
    Rails.logger.error("[BuyPowerProcessingRetryJob] error order_id=#{bill_order_id} #{e.class}: #{e.message}")
  end

  private

  def anchor_transfer_shadow_order?(order)
    payload = parse_payload(order.provider_response)
    source =
      if payload.is_a?(Hash)
        payload['source'].presence || payload[:source].presence
      end

    return true if source.to_s == 'anchor_transfer'
    return true if order.description.to_s.strip.casecmp('Anchor NGN transfer hold').zero?

    order.service_type.to_s.strip.upcase == 'OTHER' &&
      order.biller.to_s.strip.casecmp('anchor').zero?
  end

  def parse_payload(value)
    case value
    when String
      JSON.parse(value) rescue nil
    else
      value
    end
  end
end
