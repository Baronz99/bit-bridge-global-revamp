# frozen_string_literal: true

class BuyPowerReconcileJob < ApplicationJob
  queue_as :default

  TERMINAL_STATUSES = %w[completed failed refunded declined].freeze

  def perform(bill_order_id)
    order = BillOrder.find_by(id: bill_order_id)
    return unless order
    return unless order.payment_method == 'wallet'

    service = BuyPowerPaymentService.new
    provider_payload =
      case order.provider_response
      when String
        JSON.parse(order.provider_response) rescue nil
      else
        order.provider_response
      end
    provider_error =
      provider_payload&.dig('error') || provider_payload&.dig(:error) ||
      provider_payload&.dig('errors') || provider_payload&.dig(:errors) ||
      provider_payload&.dig('status').to_s.downcase == 'error' ||
      provider_payload&.dig(:status).to_s.downcase == 'error'
    if order.processing? && provider_error && order.provider_reference.blank?
      reason_value = order.reason.to_s.strip
      failure_message =
        (reason_value.empty? ? nil : reason_value) ||
        provider_payload&.dig('result', 'data', 'message') ||
        provider_payload&.dig('data', 'message') ||
        provider_payload&.dig('message') ||
        provider_payload&.dig(:message) ||
        'Vend failed'
      begin
        service.send(
          :handle_wallet_failure,
          order,
          'wallet',
          failure_message,
          provider_payload,
          status: 'failed'
        )
      rescue StandardError => e
        Rails.logger.error(
          "[BuyPowerReconcileJob] hard-error handler failed order=#{order.id} #{e.class}: #{e.message}"
        )
      end
      return
    end

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
    message = response[:response].to_s if message.blank?
    limit_reached = message.to_s.downcase.include?('daily transaction count limit')

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
        BillOrders::Finalizer.call(bill_order: order.reload)
        ensure_reconcile_release!(order)
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
        if limit_reached
          Rails.logger.warn(
            "BuyPower reconcile failed bill_order_id=#{order.id} reason=#{message}"
          )
          service.send(
            :handle_wallet_failure,
            order,
            'wallet',
            message || 'Vend failed',
            response[:response],
            status: 'failed'
          )
          return
        end
        order.update(status: 'processing', provider_response: response[:response]) if order.status != 'processing'
        self.class.set(wait: 10.minutes).perform_later(order.id)
      end
    end
  end

  private

  def ensure_reconcile_release!(order)
    wallet = order.user&.wallet
    return unless wallet
    return unless WalletLedgerEntry.exists?(bill_order: order, entry_type: :hold)
    return if WalletLedgerEntry.exists?(bill_order: order, entry_type: :release)

    amount_cents, amount = WalletLedgerEntry
                            .where(wallet: wallet, bill_order: order, entry_type: :hold)
                            .order(created_at: :desc)
                            .limit(1)
                            .pick(:amount_cents, :amount)

    release_amount =
      if amount_cents.present?
        Money.from_cents(amount_cents, wallet.currency).to_d
      else
        amount.present? ? amount.to_d : order.total_amount.presence || order.amount
      end

    WalletLedgerEntry.find_or_create_by!(wallet: wallet, bill_order: order, entry_type: :release) do |entry|
      entry.amount = release_amount.to_d
      entry.reference = order.idempotency_key
      entry.metadata = { 'source' => 'buy_power_reconcile_success', 'provider_reference' => order.provider_reference }
    end
  end
end
