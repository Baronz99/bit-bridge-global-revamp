# frozen_string_literal: true

module Cards
  class UnloadFeeApplier
    def self.call(transaction:, amount_cents:)
      new(transaction: transaction, amount_cents: amount_cents).call
    end

    def initialize(transaction:, amount_cents:)
      @transaction = transaction
      @amount_cents = amount_cents.to_i
    end

    def call
      return { status: :error, message: 'transaction missing' } if @transaction.blank?
      return { status: :ok, message: 'already_applied' } if @transaction.status == 'approved'

      fee_usd = extract_fee_usd
      gross_cents = @amount_cents.positive? ? @amount_cents : cents_from_amount(@transaction.amount)
      if fee_usd.to_d >= (gross_cents.to_d / 100)
        return { status: :error, message: 'fee_exceeds_amount' }
      end

      wallet = @transaction.wallet
      return { status: :error, message: 'wallet missing' } if wallet.blank?

      ActiveRecord::Base.transaction do
        wallet.credit_cents!(gross_cents)
        @transaction.update!(status: 'approved', amount: (gross_cents / 100.0).round(2))

        if fee_usd.to_d.positive?
          fee_reference = "#{@transaction.unique_transaction_id}:withdrawal_fee"
          unless Transaction.exists?(unique_transaction_id: fee_reference)
            fee_cents = wallet.money_to_cents(fee_usd)
            wallet.transactions.create!(
              transaction_type: 'withdrawal',
              status: 'approved',
              amount: fee_usd,
              coin_type: 'bank',
              address: 'Virtual Card Withdrawal Fee (USD)',
              unique_transaction_id: fee_reference,
              bridge_card_id: @transaction.bridge_card_id,
              metadata: {
                subtype: 'card_withdrawal_fee',
                fee_breakdown: {
                  principal_usd: (gross_cents / 100.0).round(2),
                  withdrawal_fee_usd: fee_usd.to_f
                }
              }
            )
            wallet.debit_cents!(fee_cents)
          end
        end
      end

      { status: :ok }
    end

    private

    def extract_fee_usd
      metadata = @transaction.metadata.is_a?(Hash) ? @transaction.metadata : {}
      BigDecimal(metadata['withdrawal_fee_usd'].to_s)
    rescue ArgumentError
      0.to_d
    end

    def cents_from_amount(amount)
      (BigDecimal(amount.to_s) * 100).to_i
    rescue ArgumentError
      0
    end
  end
end
