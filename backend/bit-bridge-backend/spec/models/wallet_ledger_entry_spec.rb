# frozen_string_literal: true

require 'rails_helper'

RSpec.describe WalletLedgerEntry, type: :model do
  let(:user) { create(:user) }
  let(:wallet) { user.ngn_wallet }

  def build_order
    BillOrder.create!(
      user: user,
      meter_number: SecureRandom.hex(6),
      meter_type: 'PREPAID',
      address: 'Test',
      name: 'Ledger Order',
      tariff_class: 'A',
      service_type: 'VTU',
      email: user.email,
      amount: 100,
      phone: '08000000000',
      biller: 'MTN',
      description: 'Ledger Test',
      payment_type: 'online',
      payment_method: 'wallet',
      status: 'processing'
    )
  end

  it 'bypasses raw balance check only for anchor transfer debits' do
    order = build_order
    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: order, amount: 100)

    expect do
      WalletLedgerEntry.record_debit!(wallet: wallet, bill_order: order, amount: 100, metadata: { 'source' => 'anchor_transfer' })
    end.to change(described_class, :count).by(1)

    order_two = build_order
    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: order_two, amount: 100)

    expect do
      WalletLedgerEntry.record_debit!(wallet: wallet, bill_order: order_two, amount: 100)
    end.to raise_error(ActiveRecord::RecordInvalid, /Insufficient ledger balance for debit/)
  end

  it 'blocks anchor debit when it exceeds outstanding hold' do
    order = build_order
    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: order, amount: 100)

    expect do
      WalletLedgerEntry.record_debit!(
        wallet: wallet,
        bill_order: order,
        amount: 150,
        metadata: { 'source' => 'anchor_transfer' }
      )
    end.to raise_error(ActiveRecord::RecordInvalid, /Debit amount exceeds outstanding hold/)
  end

  it 'blocks anchor debit when a release already exists' do
    order = build_order
    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: order, amount: 100)
    WalletLedgerEntry.release_hold!(wallet: wallet, bill_order: order, amount: 100)

    expect do
      WalletLedgerEntry.record_debit!(
        wallet: wallet,
        bill_order: order,
        amount: 100,
        metadata: { 'source' => 'anchor_transfer' }
      )
    end.to raise_error(ActiveRecord::RecordInvalid, /Cannot record debit after hold was released/)
  end
end
