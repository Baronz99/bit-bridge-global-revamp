# frozen_string_literal: true

require 'rails_helper'
require 'securerandom'

RSpec.describe Wallet, type: :model do
  let(:user) { create(:user) }
  let(:wallet) { user.wallet }

  def deposit(amount = 10_000)
    Transaction.create!(
      wallet: wallet,
      amount: amount,
      bonus: 0,
      status: :approved,
      transaction_type: :deposit
    )
  end

  def build_bill_order(status: 'initialized')
    BillOrder.create!(
      user: user,
      meter_number: "0801#{SecureRandom.hex(4)}",
      meter_type: 'PREPAID',
      address: 'Test',
      name: 'Ledger Test',
      tariff_class: 'A',
      service_type: 'VTU',
      email: user.email,
      amount: 1_000,
      phone: '08000000000',
      biller: 'MTN',
      description: 'Airtime',
      payment_type: 'online',
      payment_method: 'wallet',
      status: status
    )
  end

  describe 'ledger-derived balances' do
    before do
      deposit
    end

    it 'exposes ledger_available_balance through balance and real_balance for NGN wallets' do
      expect(wallet.balance).to eq(wallet.ledger_available_balance)
      expect(wallet.real_balance).to eq(wallet.ledger_available_balance)
    end

    it 'never returns a negative balance even when holds exceed deposits' do
      WalletLedgerEntry.ensure_hold!(
        wallet: wallet,
        bill_order: build_bill_order,
        amount: 20_000
      )

      expect(wallet.ledger_available_balance).to eq(BigDecimal('0'))
    end

    it 'ignores pending or failed bill orders that never generated ledger holds' do
      build_bill_order(status: 'processing')
      build_bill_order(status: 'failed')

      expect(wallet.ledger_available_balance).to eq(10_000.to_d)
    end

    it 'reduces balance when holds exist and restores after release/debit' do
      bill_order = build_bill_order(status: 'initialized')

      WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: bill_order, amount: 2_000)
      expect(wallet.reload.ledger_available_balance).to eq(8_000.to_d)

      WalletLedgerEntry.release_hold!(wallet: wallet, bill_order: bill_order, amount: 2_000)
      expect(wallet.reload.ledger_available_balance).to eq(10_000.to_d)

      WalletLedgerEntry.record_debit!(wallet: wallet, bill_order: bill_order, amount: 2_000)
      expect(wallet.reload.ledger_available_balance).to eq(8_000.to_d)
    end
  end

  describe 'USD wallet behavior' do
    it 'uses balance_cents for balance and real_balance' do
      usd_wallet = user.usd_wallet
      usd_wallet.update!(balance_cents: 20_50)

      expected = usd_wallet.cents_to_money(20_50)
      expect(usd_wallet.balance).to eq(expected)
      expect(usd_wallet.real_balance).to eq(expected)
    end
  end
end
