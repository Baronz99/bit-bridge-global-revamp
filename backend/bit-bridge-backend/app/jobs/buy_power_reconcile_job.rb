# frozen_string_literal: true

class BuyPowerReconcileJob < ApplicationJob
  queue_as :default

  TERMINAL_STATUSES = %w[completed failed refunded declined].freeze

  def perform(bill_order_id)
    order = BillOrder.find_by(id: bill_order_id)
    return unless order

    # TV verify-only orders can be initialized without provider_reference; do not reconcile.
    return if order.service_type.to_s.strip.upcase == 'TV' &&
              order.provider_reference.blank? &&
              order.status.to_s == 'initialized'

    return unless buypower_order?(order)

    service = BuyPowerPaymentService.new

    # 1) If we already have an error payload on a processing order, hard-fail + release/refund.
    provider_payload = provider_payload_from(order.provider_response)
    provider_error = provider_error?(provider_payload)

    if order.processing? && provider_error && order.provider_reference.blank?
      failure_message = failure_message_from(order, provider_payload)

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
      sync_bill_payment_intent!(order.reload)
      return
    end

    # 2) Re-query provider
    reference = order.provider_reference.presence || order.transaction_id.presence || order.id.to_s.presence || order.idempotency_key.presence
    response  = service.re_query(reference)

    unless response[:status] == :ok
      order.with_lock do
        order.reload
        return if TERMINAL_STATUSES.include?(order.status.to_s)

        if order.updated_at < 2.hours.ago
          Rails.logger.error("[reconcile] stale non-ok requery order=#{order.id} status=#{response[:status]}")
          order.update(reason: "Reconcile stalled: #{response[:status]}") if order.reason.blank?
          return
        end

        self.class.set(wait: next_reconcile_wait(order)).perform_later(order.id)
      end
      return
    end

    raw  = response[:response]
    data = extract_provider_data(raw)

    outcome     = provider_outcome(raw)
    message     = provider_message(raw, data)
    provider_id = provider_txn_id(raw, data, order)

    limit_reached = message.to_s.downcase.include?('daily transaction count limit')

    order.with_lock do
      order.reload
      return if TERMINAL_STATUSES.include?(order.status.to_s)

      case outcome
      when :success
        if electricity_service_type?(order) && data['token'].to_s.strip.blank?
          order.update(
            status: 'processing',
            provider_reference: provider_id.presence || order.provider_reference,
            provider_response: raw,
            reason: 'Payment confirmed. Token delivery is in progress.'
          )
          sync_bill_payment_intent!(order)
          self.class.set(wait: next_reconcile_wait(order)).perform_later(order.id)
          return
        end

        service.send(
          :handle_wallet_success,
          order,
          'wallet',
          order.use_commission,
          data['units'],
          data['token'],
          provider_id,
          message.presence || 'Vend successful',
          raw
        )

        # Ensure ledger settlement happens (debit conversion, etc)
        BillOrders::Finalizer.call(bill_order: order.reload)

        # Some flows leave a hold behind after success; ensure release exists (safety net).
        ensure_reconcile_release!(order)

        # Ensure the web dashboard/timeline has a record (idempotent).
        ensure_transaction_record!(order)
        sync_bill_payment_intent!(order)

      when :refunded
        service.send(
          :handle_wallet_failure,
          order,
          'wallet',
          message.presence || 'Vend refunded',
          raw,
          status: 'refunded',
          force_refund: true
        )
        sync_bill_payment_intent!(order.reload)

      when :failed
        if limit_reached
          Rails.logger.warn("BuyPower reconcile limit-reached bill_order_id=#{order.id} reason=#{message}")
        end

        service.send(
          :handle_wallet_failure,
          order,
          'wallet',
          message.presence || 'Vend failed',
          raw,
          status: 'failed'
        )
        sync_bill_payment_intent!(order.reload)

      else # :pending / unknown
        # Keep the latest provider response for troubleshooting.
        if order.status.to_s != 'processing'
          order.update(status: 'processing', provider_response: raw)
        else
          order.update(provider_response: raw) if raw.present?
        end
        sync_bill_payment_intent!(order)
        self.class.set(wait: next_reconcile_wait(order)).perform_later(order.id)
      end
    end
  end

  private

  # -------------------------
  # Provider parsing helpers
  # -------------------------

  def provider_payload_from(value)
    case value
    when String
      JSON.parse(value) rescue nil
    else
      value
    end
  end

  def extract_provider_data(raw)
    return {} unless raw.is_a?(Hash)

    raw.dig('result', 'data') ||
      raw.dig(:result, :data) ||
      raw['data'] ||
      raw[:data] ||
      {}
  end

  def provider_error?(payload)
    return false unless payload.is_a?(Hash)

    payload.dig('error') || payload.dig(:error) ||
      payload.dig('errors') || payload.dig(:errors) ||
      payload.dig('status').to_s.downcase == 'error' ||
      payload.dig(:status).to_s.downcase == 'error'
  end

  # Bank-grade: normalize all the different success shapes.
  # Requirement: treat responseCode == 100 as success.
  def provider_outcome(raw)
    return :pending unless raw.is_a?(Hash)

    data = extract_provider_data(raw)
    merged = data.is_a?(Hash) ? raw.merge(data) : raw

    # Error flags (any level)
    err =
      merged['error'] || merged[:error] ||
      merged['errors'] || merged[:errors]

    return :failed if err == true

    # Codes (TV often uses responseCode)
    code =
      merged['responseCode'] || merged[:responseCode] ||
      merged['code'] || merged[:code]

    return :success if code.to_s == '100'

    # Status strings
    status =
      merged['status'] || merged[:status]

    s = status.to_s.strip.downcase
    return :success if %w[success successful completed paid].include?(s)
    result_status = raw.dig('result', 'status')
    return :success if result_status == true
    return :refunded if %w[refund refunded reversed].include?(s)
    return :failed  if %w[failed cancelled declined].include?(s)

    :pending
  end

  def provider_message(raw, data)
    return nil unless raw.is_a?(Hash)

    data = data.is_a?(Hash) ? data : {}

    data['responseMessage'].to_s.presence ||
      data['message'].to_s.presence ||
      raw.dig('result', 'message').to_s.presence ||
      raw['message'].to_s.presence ||
      'Vend successful'
  end


  def provider_txn_id(raw, data, order)
    id =
      (data.is_a?(Hash) ? (data['id'] || data['transaction_id'] || data[:id] || data[:transaction_id]) : nil)

    id.presence ||
      (raw.is_a?(Hash) ? raw.dig('data', 'id') : nil).presence ||
      order.provider_reference.presence ||
      order.transaction_id.presence ||
      order.id
  end

  def failure_message_from(order, provider_payload)
    reason_value = order.reason.to_s.strip
    return reason_value unless reason_value.empty?

    provider_payload&.dig('result', 'data', 'message') ||
      provider_payload&.dig('data', 'message') ||
      provider_payload&.dig('message') ||
      provider_payload&.dig(:message) ||
      'Vend failed'
  end

  # -------------------------
  # Ledger + dashboard safety nets
  # -------------------------

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
      entry.metadata = {
        'source' => 'buy_power_reconcile_success',
        'provider_reference' => order.provider_reference
      }
    end
  end

  # Web dashboard uses TransactionRecord. Make sure it exists after success.
  # Idempotent: canonical reference = idempotency_key.
  def ensure_transaction_record!(order)
    reference = order.idempotency_key.presence || order.provider_reference.presence || order.id.to_s
    return if reference.blank?

    TransactionRecord.find_or_create_by!(bill_order_id: order.id) do |tr|
      tr.reference = reference
      tr.bill_order_id  = order.id
      tr.status         = order.status.to_s
      tr.amount         = (order.total_amount.presence || order.amount).to_d
      tr.event_type     = 'bill_payment'
      tr.transaction_id = order.provider_reference.presence || order.transaction_id
      tr.description    = "#{order.service_type} #{order.biller}".strip
      tr.customer_name  = order.name
      tr.email          = order.email
      tr.phone_number   = order.phone
    end
  rescue StandardError => e
    Rails.logger.error("[BuyPowerReconcileJob] ensure_transaction_record failed order=#{order.id} #{e.class}: #{e.message}")
  end

  def buypower_order?(order)
    return false unless order.payment_method.to_s == 'wallet'
    return false if anchor_transfer_shadow_order?(order)

    true
  end

  def anchor_transfer_shadow_order?(order)
    payload = provider_payload_from(order.provider_response)
    source =
      if payload.is_a?(Hash)
        payload['source'].presence || payload[:source].presence
      end

    return true if source.to_s == 'anchor_transfer'
    return true if order.description.to_s.strip.casecmp('Anchor NGN transfer hold').zero?

    order.service_type.to_s.strip.upcase == 'OTHER' &&
      order.biller.to_s.strip.casecmp('anchor').zero?
  end

  def next_reconcile_wait(order)
    if electricity_service_type?(order)
      age = Time.current - order.created_at
      return 10.seconds if age < 2.minutes
      return 20.seconds if age < 10.minutes

      return 30.seconds
    end

    10.minutes
  end

  def electricity_service_type?(order)
    order.service_type.to_s.strip.upcase == 'ELECTRICITY'
  end

  def sync_bill_payment_intent!(order)
    intent = BillPaymentIntent.where(bill_order_id: order.id).order(created_at: :desc).first
    return unless intent

    mapped_status =
      case order.status.to_s
      when 'completed' then :completed
      when 'refunded' then :refunded
      when 'failed', 'declined', 'timedout' then :failed
      else :processing
      end

    late = mapped_status == :completed && intent.expires_at.present? && Time.current > intent.expires_at
    metadata = (intent.metadata.is_a?(Hash) ? intent.metadata : {}).merge('reconciled_at' => Time.current.utc.iso8601)
    if late
      metadata['late'] = true
      metadata['late_completed_at'] = Time.current.utc.iso8601
    end

    intent.update!(
      status: mapped_status,
      provider_reference: order.provider_reference,
      metadata: metadata
    )
  rescue StandardError => e
    Rails.logger.error("[BuyPowerReconcileJob] sync_bill_payment_intent failed order=#{order.id} #{e.class}: #{e.message}")
  end
end

