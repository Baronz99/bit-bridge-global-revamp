# frozen_string_literal: true

module BillOrders
  class Finalizer
    ENTRY_REFERENCE_PREFIX = 'bill_order/debit'.freeze

    def self.call(bill_order:)
      new(bill_order: bill_order).call
    end

    def initialize(bill_order:)
      @bill_order = bill_order
      @wallet = Wallet.find_by(user_id: bill_order.user_id, wallet_type: :ngn)
    end

    def call
      return bill_order unless bill_order.completed?
      return bill_order unless wallet_funded?
      return bill_order unless wallet
      return bill_order unless amount.positive?

      ensure_debit!
      bill_order
    end

    private

    attr_reader :bill_order, :wallet

    def wallet_funded?
      bill_order.payment_method.to_s == 'wallet'
    end

    def ensure_debit!
      return if WalletLedgerEntry.debit_exists?(wallet: wallet, bill_order: bill_order)

      WalletLedgerEntry.record_debit!(
        wallet: wallet,
        bill_order: bill_order,
        amount: amount,
        reference: debit_reference,
        metadata: {
          'source' => 'bill_order_finalize',
          'bill_order_id' => bill_order.id
        }
      )
    end

    def amount
      (bill_order.total_amount.presence || bill_order.amount).to_d
    end

    def debit_reference
      "#{ENTRY_REFERENCE_PREFIX}/#{bill_order.id}"
    end
  end
end
