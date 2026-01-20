# frozen_string_literal: true

require 'rails_helper'

RSpec.describe WalletLedgerEntry, type: :model do
  it 'does not create duplicate logical ledger entries' do
    user = create(:user)
    wallet = user.wallet
    bill_order = BillOrder.create!(
      user: user,
      meter_number: '08012345678',
      meter_type: 'PREPAID',
      address: 'Test Address',
      name: 'Test User',
      tariff_class: 'A',
      service_type: 'VTU',
      email: user.email,
      amount: 1000,
      phone: '08012345678',
      biller: 'MTN',
      description: 'Airtime',
      payment_type: 'online',
      payment_method: 'wallet'
    )

    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: bill_order, amount: 1000)
    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: bill_order, amount: 1000)
    expect(WalletLedgerEntry.where(wallet: wallet, bill_order: bill_order, entry_type: :hold).count).to eq(1)

    WalletLedgerEntry.record_debit!(wallet: wallet, bill_order: bill_order, amount: 1000)
    WalletLedgerEntry.record_debit!(wallet: wallet, bill_order: bill_order, amount: 1000)
    expect(WalletLedgerEntry.where(wallet: wallet, bill_order: bill_order, entry_type: :debit).count).to eq(1)

    WalletLedgerEntry.record_refund!(wallet: wallet, bill_order: bill_order, amount: 1000)
    WalletLedgerEntry.record_refund!(wallet: wallet, bill_order: bill_order, amount: 1000)
    expect(WalletLedgerEntry.where(wallet: wallet, bill_order: bill_order, entry_type: :refund).count).to eq(1)
  end
end
