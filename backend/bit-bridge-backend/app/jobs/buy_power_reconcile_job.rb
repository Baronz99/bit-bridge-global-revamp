# frozen_string_literal: true

class BuyPowerReconcileJob < ApplicationJob
  queue_as :default

  TERMINAL_STATUSES = %w[completed failed refunded declined].freeze

  def perform(bill_order_id)
    order = BillOrder.find_by(id: bill_order_id)
    return unless order
    return unless order.payment_method == 'wallet'

    service = BuyPowerPaymentService.new
    reference = order.provider_reference.presence || order.id
    response = service.re_query(reference)

    unless response[:status] == :ok
      order.with_lock do
        order.reload
        return if TERMINAL_STATUSES.include?(order.status.to_s)
        if order.updated_at < 2.hours.ago
          Rails.logger.error("[reconcile] stale non-ok requery order=#{order.id} status=#{response[:status]}")
          order.update(reason: "Reconcile stalled: #{response[:status]}") if order.reason.blank?
          return
        end
        self.class.set(wait: 10.minutes).perform_later(order.id)
      end
      return
    end

    data = response[:response]&.dig('result', 'data') || response[:response]&.dig('data') || {}
    provider_status = data['status'].to_s.downcase
    message = data['message'].to_s.presence || response[:response]&.dig('message')

    order.with_lock do
      order.reload
      return if TERMINAL_STATUSES.include?(order.status.to_s)

      case provider_status
      when 'success', 'successful', 'completed', 'paid'
        service.send(
          :handle_wallet_success,
          order,
          'wallet',
          order.use_commission,
          data['units'],
          data['token'],
          data['id'] || data['transaction_id'] || order.provider_reference,
          message || 'Vend successful',
          response[:response]
        )
      when 'failed', 'refund', 'refunded', 'reversed', 'cancelled'
        service.send(
          :handle_wallet_failure,
          order,
          'wallet',
          message || 'Vend failed',
          response[:response],
          status: provider_status == 'refund' || provider_status == 'refunded' ? 'refunded' : 'failed'
        )
      else
        order.update(status: 'processing', provider_response: response[:response]) if order.status != 'processing'
        self.class.set(wait: 10.minutes).perform_later(order.id)
      end
    end
  end
end
