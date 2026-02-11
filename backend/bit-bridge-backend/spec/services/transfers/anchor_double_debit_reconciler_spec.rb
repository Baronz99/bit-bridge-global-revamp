# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transfers::AnchorDoubleDebitReconciler do
  let(:user) { create(:user, email: "anchor-reconcile-#{SecureRandom.hex(4)}@example.com") }
  let(:wallet) { user.ngn_wallet }
  let(:transfer_reference) { "anc-ref-#{SecureRandom.hex(4)}" }

  def create_bill_order(ref)
    BillOrder.create!(
      user: user,
      meter_number: ref,
      meter_type: 'PREPAID',
      address: 'Anchor transfer hold',
      name: 'Anchor transfer',
      tariff_class: 'A',
      service_type: 'OTHER',
      email: user.email,
      amount: 5_076.8,
      phone: '0000000000',
      biller: 'Anchor',
      description: 'Anchor NGN transfer hold',
      payment_type: 'online',
      payment_method: 'wallet',
      status: 'completed',
      metadata: { source: 'anchor_transfer', transfer_reference: ref }
    )
  end

  before do
    wallet.transactions.create!(
      transaction_type: 'deposit',
      status: 'approved',
      amount: 20_000,
      coin_type: 'bank',
      address: 'Seed balance'
    )
  end

  it 'backfills ledger_hold_reserved for settled anchor transfer components' do
    order = create_bill_order(transfer_reference)
    WalletLedgerEntry.record_debit!(
      wallet: wallet,
      bill_order: order,
      amount: 5_076.8,
      reference: "anchor-transfer-debit/#{transfer_reference}",
      metadata: { 'source' => 'anchor_transfer', 'transfer_reference' => transfer_reference }
    )

    principal = wallet.transactions.create!(
      transaction_type: 'withdrawal',
      status: 'approved',
      amount: 5_000,
      coin_type: 'bank',
      address: 'Anchor principal',
      metadata: { provider: 'anchor', subtype: 'principal', transfer_reference: transfer_reference }
    )
    fee = wallet.transactions.create!(
      transaction_type: 'withdrawal',
      status: 'approved',
      amount: 76.8,
      coin_type: 'bank',
      address: 'Anchor fee',
      metadata: { provider: 'anchor', subtype: 'fee', transfer_reference: transfer_reference }
    )

    before_balance = wallet.reload.ledger_available_balance
    expect(before_balance).to eq(9_846.4.to_d)

    result = described_class.call(email: user.email, dry_run: false, limit: 10)

    expect(result[:errors]).to eq(0)
    expect(result[:candidate_references]).to eq(1)
    expect(result[:updated_transactions]).to eq(2)

    expect(principal.reload.metadata['ledger_hold_reserved']).to eq(true)
    expect(fee.reload.metadata['ledger_hold_reserved']).to eq(true)
    expect(wallet.reload.ledger_available_balance).to eq(14_923.2.to_d)
  end

  it 'does not write in dry_run mode' do
    order = create_bill_order(transfer_reference)
    WalletLedgerEntry.record_debit!(
      wallet: wallet,
      bill_order: order,
      amount: 5_076.8,
      reference: "anchor-transfer-debit/#{transfer_reference}",
      metadata: { 'source' => 'anchor_transfer', 'transfer_reference' => transfer_reference }
    )

    principal = wallet.transactions.create!(
      transaction_type: 'withdrawal',
      status: 'approved',
      amount: 5_000,
      coin_type: 'bank',
      address: 'Anchor principal',
      metadata: { provider: 'anchor', subtype: 'principal', transfer_reference: transfer_reference }
    )

    result = described_class.call(email: user.email, dry_run: true, limit: 10)

    expect(result[:updated_transactions]).to eq(1)
    expect(principal.reload.metadata['ledger_hold_reserved']).to be_nil
  end
end
