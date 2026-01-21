# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Wallet, type: :model do
  describe '#ledger_available_balance' do
    let(:user) { create(:user) }
    let(:wallet) { user.wallet }

    before do
      Transaction.create!(
        wallet: wallet,
        amount: 10_000,
        bonus: 0,
        status: :approved,
        transaction_type: :deposit
      )
    end

    it 'ignores pending bill orders without ledger holds' do
      BillOrder.create!(
        user: user,
        meter_number: '08011112222',
        meter_type: 'PREPAID',
        address: 'Test',
        name: 'Pending',
        tariff_class: 'A',
        service_type: 'VTU',
        email: user.email,
        amount: 1_000,
        phone: '08000000000',
        biller: 'MTN',
        description: 'Airtime',
        payment_type: 'online',
        payment_method: 'wallet',
        status: 'processing'
      )

      expect(wallet.ledger_available_balance).to eq(10_000.to_d)
    end

    it 'reduces available balance when holds exist and restores after release/debit' do
      bill_order = BillOrder.create!(
        user: user,
        meter_number: '08011112233',
        meter_type: 'PREPAID',
        address: 'Test',
        name: 'Hold',
        tariff_class: 'A',
        service_type: 'VTU',
        email: user.email,
        amount: 2_000,
        phone: '08000000001',
        biller: 'MTN',
        description: 'Airtime',
        payment_type: 'online',
        payment_method: 'wallet',
        status: 'processing'
      )

      WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: bill_order, amount: 2_000)
      expect(wallet.ledger_available_balance).to eq(8_000.to_d)

      WalletLedgerEntry.release_hold!(wallet: wallet, bill_order: bill_order, amount: 2_000)
      WalletLedgerEntry.record_debit!(wallet: wallet, bill_order: bill_order, amount: 2_000)

      expect(wallet.ledger_available_balance).to eq(10_000.to_d)
    end
  end
end
