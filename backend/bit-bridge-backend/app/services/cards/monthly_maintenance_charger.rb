# frozen_string_literal: true

module Cards
  class MonthlyMaintenanceCharger
    def self.call(reference_time: Time.current)
      new(reference_time: reference_time).call
    end

    def initialize(reference_time:)
      @reference_time = reference_time
      @policy = Pricing::CardFeePolicy.new
    end

    def call
      fee_usd = @policy.monthly_maintenance_fee_usd
      return { status: :ok, charged: 0 } if fee_usd.to_d <= 0

      month_key = @reference_time.strftime('%Y-%m')
      charged = 0

      Card.where(status: 'active').find_each do |card|
        next if charged_this_month?(card, month_key)

        wallet = card.user&.usd_wallet
        next if wallet.blank?

        fee_cents = wallet.money_to_cents(fee_usd)
        next if wallet.balance_cents.to_i < fee_cents

        unique_id = "card-maintenance-#{card.id}-#{month_key}"
        next if Transaction.exists?(unique_transaction_id: unique_id)

        ActiveRecord::Base.transaction do
          wallet.transactions.create!(
            transaction_type: 'withdrawal',
            status: 'approved',
            amount: fee_usd,
            coin_type: 'bank',
            address: 'Card monthly maintenance fee',
            unique_transaction_id: unique_id,
            bridge_card_id: card.card_id,
            metadata: {
              subtype: 'card_monthly_maintenance',
              fee_breakdown: {
                maintenance_fee_usd: fee_usd.to_f
              }
            }
          )

          wallet.debit_cents!(fee_cents)
          card.update!(last_maintenance_fee_charged_at: @reference_time)
          charged += 1
        end
      end

      { status: :ok, charged: charged }
    end

    private

    def charged_this_month?(card, month_key)
      last = card.last_maintenance_fee_charged_at
      return false if last.blank?

      last.strftime('%Y-%m') == month_key
    end
  end
end
