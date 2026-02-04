# frozen_string_literal: true

class BuyPowerProcessingRetryJob < ApplicationJob
  queue_as :default

  def perform(bill_order_id)
    order = BillOrder.find_by(id: bill_order_id)
    return unless order
    return unless order.processing?

    BuyPowerReconcileJob.perform_later(order.id)
  rescue StandardError => e
    Rails.logger.error("[BuyPowerProcessingRetryJob] error order_id=#{bill_order_id} #{e.class}: #{e.message}")
  end
end
