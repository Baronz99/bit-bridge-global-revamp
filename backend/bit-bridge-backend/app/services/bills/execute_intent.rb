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

        WalletLedgerEntry.ensure_hold!(
          wallet: wallet,
          bill_order: bill_order,
          amount: @intent.total.to_d,
          reference: @intent.id,
          metadata: {
            'bill_payment_intent_id' => @intent.id,
            'request_id' => @request_id
          }
        )

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
        @intent.update!(
          status: :completed,
          provider_reference: bill_order.provider_reference,
          metadata: intent_metadata('last_result' => status)
        )
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
        required_total: @intent.total.to_d.to_f,
        available_balance: wallet.ledger_available_balance.to_d.to_f,
        shortfall: [@intent.total.to_d - wallet.ledger_available_balance.to_d, 0.to_d].max.to_f,
        intent: intent_payload
      } }
    end

    def intent_payload
      @intent.reload.as_json(only: %i[id status bill_type amount fee total provider_reference expires_at created_at updated_at], methods: [])
    end
  end
end
