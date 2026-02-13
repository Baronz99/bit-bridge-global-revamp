# frozen_string_literal: true

module Bills
  class ExecuteIntent
    DEFAULT_EXPIRY = 30.minutes

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
        ActiveModel::Type::Boolean.new.cast(bill_order.use_commission),
        request_id: @request_id,
        idempotency_key: @intent.id
      )

      finalize_from_result!(result: result, bill_order: bill_order.reload)
    end

    private

    def wallet
      @wallet ||= @intent.user&.wallet
    end

    def expired?
      @intent.expires_at.present? && @intent.expires_at < Time.current
    end

    def sufficient_balance?(bill_order:)
      return true if hold_exists?(bill_order: bill_order)

      wallet.ledger_available_balance >= @intent.total.to_d
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
        bill_order.status = :pending if bill_order.initialized?
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
      expected_total = @intent.total.to_d
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
      { http_status: :ok, body: { success: true, message: message, intent: intent_payload } }
    end

    def pending_response(message)
      { http_status: :accepted, body: { success: false, status: 'pending', message: message, intent: intent_payload } }
    end

    def failure_response(message)
      { http_status: :unprocessable_entity, body: { success: false, message: message, intent: intent_payload } }
    end

    def insufficient_funds_response
      { http_status: :unprocessable_entity, body: {
        success: false,
        error_code: 'INSUFFICIENT_FUNDS',
        message: 'Insufficient wallet balance',
        details: {
          required_total: @intent.total.to_d.to_f,
          available_balance: wallet.ledger_available_balance.to_d.to_f,
          shortfall: [@intent.total.to_d - wallet.ledger_available_balance.to_d, 0.to_d].max.to_f
        },
        retryable: true,
        intent: intent_payload
      } }
    end

    def intent_payload
      @intent.reload.as_json(only: %i[id status bill_type amount fee total provider_reference expires_at created_at updated_at], methods: [])
    end
  end
end
