# frozen_string_literal: true

module Bills
  class ExecuteIntent
    DEFAULT_EXPIRY = 30.minutes
    PROVIDER_STATUS_FRESHNESS = 10.minutes
    MIN_STATUS_SAMPLE_SIZE = 10

    def self.call(intent:, request_id: nil)
      new(intent: intent, request_id: request_id).call
    end

    def initialize(intent:, request_id:)
      @intent = intent
      @request_id = request_id
    end

    def call
      return success_response('Bill payment already completed') if @intent.completed?
      return pending_response('Bill payment is processing') if @intent.processing?

      bill_order = @intent.bill_order
      return failure_response('Bill order not found for this intent') if bill_order.blank?
      return failure_response('Wallet not found') if wallet.blank?

      guard_response = service_checkout_guard_response(bill_order: bill_order)
      return guard_response if guard_response.present?

      if already_financially_finalized?(bill_order: bill_order)
        finalize_completed_intent!(bill_order: bill_order, result: 'already_finalized')
        return success_response('Bill payment already completed')
      end

      if expired?
        @intent.update!(status: :expired)
        return failure_response('Bill payment intent has expired')
      end

      unless sufficient_balance?(bill_order: bill_order)
        @intent.update!(status: :awaiting_funds, expires_at: Time.current + DEFAULT_EXPIRY)
        return insufficient_funds_response
      end

      prepare_for_execution!(bill_order: bill_order)

      service = BuyPowerPaymentService.new
      result = service.confirm_subscription(
        bill_order,
        'wallet',
        use_commission?,
        request_id: @request_id,
        idempotency_key: @intent.id
      )

      finalize_from_result!(result: result, bill_order: bill_order.reload)
    end

    private

def service_checkout_guard_response(bill_order:)
  status = current_provider_status_for(bill_order: bill_order)
  return nil if status.blank?

  return service_unavailable_response(status) if status[:state] == 'down'

  if status[:state] == 'unstable'
    @service_warning = {
      code: 'SERVICE_UNSTABLE',
      message: 'Service is currently unstable. Transaction may be delayed.',
      details: {
        service_key: status[:service_key],
        reliability_percent: status[:reliability_percent],
        sample_size: status[:sample_size],
        window_ended_at: status[:window_ended_at]
      }
    }
  end

  nil
end

def current_provider_status_for(bill_order:)
  key = provider_service_key_for(bill_order: bill_order)
  row = ProviderServiceStatus
          .where(provider: 'buypower', service_key: key)
          .where('updated_at >= ?', Time.current - PROVIDER_STATUS_FRESHNESS)
          .order(updated_at: :desc)
          .first
  return nil if row.blank?
  return nil if row.sample_size.to_i < MIN_STATUS_SAMPLE_SIZE

  {
    service_key: row.service_key,
    state: row.state,
    reliability_percent: row.reliability_percent,
    sample_size: row.sample_size,
    window_ended_at: row.window_ended_at&.iso8601
  }
end

def provider_service_key_for(bill_order:)
  service_type = bill_order.service_type.to_s.strip.upcase
  biller = bill_order.biller.to_s.strip.upcase.gsub(/ +/, '_')
  return service_type if biller.empty?

  "#{biller}_#{service_type}"
end

    def wallet
      @wallet ||= @intent.user&.wallet
    end

    def expired?
      @intent.expires_at.present? && @intent.expires_at < Time.current
    end

    def sufficient_balance?(bill_order:)
      return true if hold_exists?(bill_order: bill_order)

      wallet.ledger_available_balance >= required_wallet_debit(bill_order: bill_order)
    end

    def hold_exists?(bill_order:)
      WalletLedgerEntry.exists?(wallet: wallet, bill_order: bill_order, entry_type: :hold)
    end

    def prepare_for_execution!(bill_order:)
      ActiveRecord::Base.transaction do
        wallet.lock!
        @intent.lock!
        bill_order.lock!

        bill_order.payment_method = :wallet
        bill_order.idempotency_key = @intent.id
        bill_order.save! if bill_order.changed?

        validate_or_repair_hold!(bill_order: bill_order)

        @intent.update!(
          status: :processing,
          expires_at: @intent.expires_at.presence || (Time.current + DEFAULT_EXPIRY),
          metadata: intent_metadata('execution_started' => true, 'bill_order_id' => bill_order.id)
        )
      end
    end

    def finalize_from_result!(result:, bill_order:)
      status = result[:status].to_s

      case status
      when 'success'
        ensure_financial_finalization!(bill_order: bill_order)
        finalize_completed_intent!(bill_order: bill_order, result: status)
        success_response('payment confirmed')
      when 'pending'
        @intent.update!(
          status: :processing,
          provider_reference: bill_order.provider_reference,
          metadata: intent_metadata('last_result' => status)
        )
        enqueue_reconcile!(bill_order: bill_order)
        pending_response(result[:response].presence || 'Payment pending...')
      else
        mapped_status = bill_order.status.to_s == 'refunded' ? :refunded : :failed
        @intent.update!(
          status: mapped_status,
          provider_reference: bill_order.provider_reference,
          metadata: intent_metadata('last_result' => status)
        )
        failure_response(result[:response].presence || result[:message].presence || 'Payment failed')
      end
    end

    def intent_metadata(extra = {})
      base = @intent.metadata.is_a?(Hash) ? @intent.metadata : {}
      base.merge(extra)
    end

    def already_financially_finalized?(bill_order:)
      bill_order.completed? && WalletLedgerEntry.debit_exists?(wallet: wallet, bill_order: bill_order)
    end

    def finalize_completed_intent!(bill_order:, result:)
      late = late_completion?
      metadata = intent_metadata('last_result' => result, 'late' => late)
      metadata['late_completed_at'] = Time.current.utc.iso8601 if late

      @intent.update!(
        status: :completed,
        provider_reference: bill_order.provider_reference,
        metadata: metadata
      )
    end

    def late_completion?
      @intent.expires_at.present? && Time.current > @intent.expires_at
    end

    def validate_or_repair_hold!(bill_order:)
      expected_total = required_wallet_debit(bill_order: bill_order)
      hold_entry = WalletLedgerEntry.where(wallet: wallet, bill_order: bill_order, entry_type: :hold).order(created_at: :desc).first
      release_entries = WalletLedgerEntry.where(wallet: wallet, bill_order: bill_order, entry_type: :release).order(created_at: :desc).to_a
      release_entry = release_entries.first
      debit_entry = WalletLedgerEntry.where(wallet: wallet, bill_order: bill_order, entry_type: :debit).order(created_at: :desc).first

      # If a debit already exists, funds are settled and hold repair is unnecessary.
      return if debit_entry.present?

      if hold_entry.blank?
        WalletLedgerEntry.ensure_hold!(
          wallet: wallet,
          bill_order: bill_order,
          amount: expected_total,
          reference: @intent.id,
          metadata: {
            'bill_payment_intent_id' => @intent.id,
            'request_id' => @request_id,
            'hold_repaired' => false
          }
        )
        return
      end

      active_hold = hold_entry.amount.to_d - release_entries.sum { |entry| entry.amount.to_d }
      hold_is_active = active_hold.positive?
      hold_amount_matches = active_hold == expected_total
      return if hold_is_active && hold_amount_matches

      # Repair released/mismatched hold into a single active hold with expected total.
      release_entry&.destroy!
      hold_metadata = hold_entry.metadata.is_a?(Hash) ? hold_entry.metadata : {}
      hold_entry.update!(
        amount: expected_total,
        reference: @intent.id,
        metadata: hold_metadata.merge(
          'bill_payment_intent_id' => @intent.id,
          'request_id' => @request_id,
          'hold_repaired' => true,
          'repaired_at' => Time.current.utc.iso8601
        )
      )
    end

    def ensure_financial_finalization!(bill_order:)
      BillOrders::Finalizer.call(bill_order: bill_order)
      return if hold_settled?(bill_order: bill_order)

      raise ActiveRecord::RecordInvalid, @intent
    end

    def hold_settled?(bill_order:)
      totals = WalletLedgerEntry.ledger_totals(wallet: wallet, bill_order: bill_order)
      outstanding = totals[:hold] - totals[:release] - totals[:debit]
      outstanding <= 0.to_d && WalletLedgerEntry.debit_exists?(wallet: wallet, bill_order: bill_order)
    end

    def success_response(message)
      body = { success: true, message: message, intent: intent_payload }
      { http_status: :ok, body: append_service_warning(body) }
    end

    def pending_response(message)
      body = {
        success: false,
        status: 'pending',
        message: message,
        intent_id: @intent.id,
        bill_order_id: @intent.bill_order_id,
        retryable: true
      }
      { http_status: :accepted, body: append_service_warning(body) }
    end

    def failure_response(message)
      body = { success: false, message: message, intent: intent_payload }
      { http_status: :unprocessable_entity, body: append_service_warning(body) }
    end

    def insufficient_funds_response
      required_total = required_wallet_debit(bill_order: @intent.bill_order)
      available_balance = wallet.ledger_available_balance.to_d

      body = {
        success: false,
        error_code: 'INSUFFICIENT_FUNDS',
        message: 'Insufficient wallet balance',
        details: {
          required_total: required_total.to_f,
          available_balance: available_balance.to_f,
          shortfall: [required_total - available_balance, 0.to_d].max.to_f
        },
        retryable: true,
        intent: intent_payload
      }
      { http_status: :unprocessable_entity, body: append_service_warning(body) }
    end

    def service_unavailable_response(status)
      {
        http_status: :unprocessable_entity,
        body: {
          success: false,
          error_code: 'SERVICE_UNAVAILABLE',
          message: 'This service is temporarily unavailable. Please try again later.',
          details: {
            service_key: status[:service_key],
            state: status[:state],
            reliability_percent: status[:reliability_percent],
            sample_size: status[:sample_size],
            window_ended_at: status[:window_ended_at]
          },
          retryable: true,
          intent: intent_payload
        }
      }
    end

    def append_service_warning(body)
      return body if @service_warning.blank?

      body.merge(warning: @service_warning)
    end

    def use_commission?
      metadata = @intent.metadata.is_a?(Hash) ? @intent.metadata : {}
      raw = metadata.key?('use_commission') ? metadata['use_commission'] : @intent.bill_order&.use_commission
      ActiveModel::Type::Boolean.new.cast(raw)
    end

    def required_wallet_debit(bill_order:)
      total = @intent.total.to_d
      return total unless use_commission?
      return total unless %w[VTU AIRTIME DATA].include?(bill_order.service_type.to_s.upcase)

      [total - wallet.commission.to_d, 0.to_d].max
    end

    def intent_payload
      @intent.reload.as_json(only: %i[id status bill_type amount fee total provider_reference expires_at created_at updated_at], methods: [])
    end

    def enqueue_reconcile!(bill_order:)
      return if bill_order.blank?

      BuyPowerReconcileJob.set(wait: 30.seconds).perform_later(bill_order.id)
    rescue StandardError
      nil
    end
  end
end



