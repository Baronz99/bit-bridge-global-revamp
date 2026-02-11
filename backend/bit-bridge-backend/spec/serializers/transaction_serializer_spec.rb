# frozen_string_literal: true

require 'rails_helper'

RSpec.describe TransactionSerializer, type: :serializer do
  let(:user) { create(:user, :tier2, email: "txn-serializer-#{SecureRandom.hex(4)}@example.com") }

  def build_transaction(attrs = {})
    user.ngn_wallet.transactions.create!(
      {
        transaction_type: :deposit,
        status: :approved,
        coin_type: :bank,
        amount: 25,
        address: 'Test funding'
      }.merge(attrs)
    )
  end

  it 'uses transaction_record reference when present' do
    tx = build_transaction
    record = TransactionRecord.create!(
      exchange_id: tx.id,
      reference: 'fbg-9001',
      status: 'pending',
      event_type: 'checkout.init'
    )

    payload = described_class.new(tx).as_json
    expect(payload[:reference]).to eq(record.reference)
  end

  it 'falls back to transfer_id when no record exists' do
    tx = build_transaction(transfer_id: 'trf-123')

    payload = described_class.new(tx).as_json
    expect(payload[:reference]).to eq('trf-123')
  end

  it 'returns nil when neither record nor transfer_id exists' do
    tx = build_transaction

    payload = described_class.new(tx).as_json
    expect(payload[:reference]).to be_nil
  end

  it 'includes ledger balance snapshot for anchor principal transfer rows' do
    skip 'wallet_ledger_entries balance snapshot columns not migrated in this DB' unless
      WalletLedgerEntry.column_names.include?('before_available_balance')

    wallet = user.ngn_wallet
    wallet.transactions.create!(
      transaction_type: 'deposit',
      status: 'approved',
      coin_type: 'bank',
      amount: 1_000,
      address: 'Seed'
    )

    order = BillOrder.create!(
      user: user,
      meter_number: "ledger-#{SecureRandom.hex(4)}",
      meter_type: 'PREPAID',
      address: 'Test',
      name: 'Anchor Transfer',
      tariff_class: 'A',
      service_type: 'OTHER',
      email: user.email,
      amount: 150,
      phone: '08000000000',
      biller: 'Anchor',
      description: 'Anchor transfer hold',
      payment_type: 'online',
      payment_method: 'wallet',
      status: 'processing',
      metadata: { source: 'anchor_transfer', transfer_reference: 'tx-ref-1' }
    )

    WalletLedgerEntry.ensure_hold!(
      wallet: wallet,
      bill_order: order,
      amount: 150,
      metadata: { transfer_reference: 'tx-ref-1' }
    )

    tx = wallet.transactions.create!(
      transaction_type: 'withdrawal',
      status: 'pending',
      coin_type: 'bank',
      amount: 100,
      address: 'Anchor payout',
      metadata: { provider: 'anchor', subtype: 'principal', transfer_reference: 'tx-ref-1' }
    )

    payload = described_class.new(tx).as_json
    snapshot = payload[:balance_snapshot]

    expect(snapshot).to be_present
    expect(snapshot[:entry_type]).to eq('hold')
    expect(snapshot.dig(:before_event_balance, :book)).to be_nil
    expect(snapshot.dig(:after_event_balance, :book)).to be_nil
    expect(snapshot.dig(:before_event_balance, :available)).to eq(1_000.0)
    expect(snapshot.dig(:after_event_balance, :available)).to eq(850.0)
  end

  it 'includes transaction balance snapshot for non-anchor transactions' do
    skip 'transaction balance snapshot columns not migrated in this DB' unless
      Transaction.column_names.include?('before_available_balance')

    wallet = user.ngn_wallet
    wallet.transactions.create!(
      transaction_type: 'deposit',
      status: 'approved',
      coin_type: 'bank',
      amount: 500,
      address: 'Seed'
    )

    tx = wallet.transactions.create!(
      transaction_type: 'deposit',
      status: 'approved',
      coin_type: 'bank',
      amount: 100,
      address: 'Inbound'
    )

    payload = described_class.new(tx).as_json
    snapshot = payload[:balance_snapshot]

    expect(snapshot).to be_present
    expect(snapshot[:entry_type]).to eq('transaction')
    expect(snapshot.dig(:before_event_balance, :book)).to be_nil
    expect(snapshot.dig(:after_event_balance, :book)).to be_nil
    expect(snapshot.dig(:before_event_balance, :available)).to eq(500.0)
    expect(snapshot.dig(:after_event_balance, :available)).to eq(600.0)
  end
end
