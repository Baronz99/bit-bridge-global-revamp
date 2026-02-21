# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transfers::AnchorFailedDebitRefundReconciler do
  let(:user) { create(:user, email: "anchor-failed-reconcile-#{SecureRandom.hex(4)}@example.com") }
  let(:wallet) { user.ngn_wallet }
  let(:transfer_reference) { "anc-failed-#{SecureRandom.hex(4)}" }

  def create_anchor_transfer_order(ref)
    BillOrder.create!(
      user: user,
      meter_number: ref,
      meter_type: 'PREPAID',
      address: 'Anchor transfer hold',
      name: 'Anchor transfer',
      tariff_class: 'A',
      service_type: 'OTHER',
      email: user.email,
      amount: 1_050,
      phone: '0000000000',
      biller: 'Anchor',
      description: 'Anchor NGN transfer hold',
      payment_type: 'online',
      payment_method: 'wallet',
      status: 'processing',
      metadata: { source: 'anchor_transfer', transfer_reference: ref }
    )
  end

  before do
    wallet.transactions.create!(
      transaction_type: 'deposit',
      status: 'approved',
      amount: 10_000,
      coin_type: 'bank',
      address: 'Seed balance'
    )
  end

  it 'detects failed anchor debits without refunds in dry_run mode' do
    order = create_anchor_transfer_order(transfer_reference)
    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: order, amount: 1_050, metadata: { transfer_reference: transfer_reference })
    WalletLedgerEntry.record_debit!(
      wallet: wallet,
      bill_order: order,
      amount: 1_050,
      reference: "anchor-transfer-debit/#{transfer_reference}",
      metadata: { 'source' => 'anchor_transfer', 'transfer_reference' => transfer_reference }
    )

    wallet.transactions.create!(
      transaction_type: 'withdrawal',
      status: 'failed',
      amount: 1_000,
      coin_type: 'bank',
      address: 'Anchor principal',
      metadata: { provider: 'anchor', subtype: 'principal', transfer_reference: transfer_reference }
    )
    wallet.transactions.create!(
      transaction_type: 'withdrawal',
      status: 'failed',
      amount: 50,
      coin_type: 'bank',
      address: 'Anchor fee',
      metadata: { provider: 'anchor', subtype: 'fee', transfer_reference: transfer_reference }
    )

    result = described_class.call(email: user.email, dry_run: true, limit: 10)

    expect(result[:candidate_references]).to eq(1)
    expect(result[:repaired_references]).to eq(0)
    expect(result[:remaining_unrecovered]).to eq(1)
    expect(WalletLedgerEntry.where(wallet: wallet, bill_order: order, entry_type: :refund).count).to eq(0)
  end

  it 'repairs missing refunds idempotently in commit mode' do
    order = create_anchor_transfer_order(transfer_reference)
    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: order, amount: 1_050, metadata: { transfer_reference: transfer_reference })
    WalletLedgerEntry.record_debit!(
      wallet: wallet,
      bill_order: order,
      amount: 1_050,
      reference: "anchor-transfer-debit/#{transfer_reference}",
      metadata: { 'source' => 'anchor_transfer', 'transfer_reference' => transfer_reference }
    )

    wallet.transactions.create!(
      transaction_type: 'withdrawal',
      status: 'failed',
      amount: 1_000,
      coin_type: 'bank',
      address: 'Anchor principal',
      metadata: { provider: 'anchor', subtype: 'principal', transfer_reference: transfer_reference }
    )
    wallet.transactions.create!(
      transaction_type: 'withdrawal',
      status: 'failed',
      amount: 50,
      coin_type: 'bank',
      address: 'Anchor fee',
      metadata: { provider: 'anchor', subtype: 'fee', transfer_reference: transfer_reference }
    )

    first = described_class.call(email: user.email, dry_run: false, limit: 10)
    expect(first[:candidate_references]).to eq(1)
    expect(first[:repaired_references]).to eq(1)
    expect(first[:remaining_unrecovered]).to eq(0)

    refund_entries = WalletLedgerEntry.where(wallet: wallet, bill_order: order, entry_type: :refund)
    expect(refund_entries.count).to eq(1)
    expect(refund_entries.first.amount.to_d).to eq(1_050.to_d)

    second = described_class.call(email: user.email, dry_run: false, limit: 10)
    expect(second[:repaired_references]).to eq(0)
    expect(second[:remaining_unrecovered]).to eq(0)
    expect(WalletLedgerEntry.where(wallet: wallet, bill_order: order, entry_type: :refund).count).to eq(1)
  end
end
