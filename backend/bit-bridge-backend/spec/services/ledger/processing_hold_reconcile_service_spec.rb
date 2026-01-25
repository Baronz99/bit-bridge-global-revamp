# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Ledger::ProcessingHoldReconcileService, type: :service do
  let(:user) { create(:user) }
  let(:wallet) { user.wallet }

  def seed_wallet(amount = 500)
    wallet.transactions.create!(
      transaction_type: 'deposit',
      status: 'approved',
      amount: amount,
      coin_type: 'bank',
      address: 'Seed balance'
    )
  end

  def build_order(status: 'processing')
    BillOrder.create!(
      user: user,
      meter_number: SecureRandom.hex(6),
      meter_type: 'PREPAID',
      address: 'Test',
      name: 'Processing Order',
      tariff_class: 'A',
      service_type: 'VTU',
      email: user.email,
      amount: 100,
      phone: '08000000000',
      biller: 'MTN',
      description: 'Recon Test',
      payment_type: 'online',
      payment_method: 'wallet',
      status: status
    )
  end

  def service_with_status(status_symbol, commit: true)
    client = instance_double(BuyPowerPaymentService)
    response = { status: :ok, response: { 'data' => { 'status' => status_symbol.to_s.upcase } } }
    allow(client).to receive(:re_query).and_return(response)
    described_class.new(commit: commit, provider_client: client)
  end

  it 'creates a debit (no release) for provider success and is idempotent' do
    order = build_order
    seed_wallet
    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: order, amount: 100)

    service = service_with_status(:success)
    service.run
    expect(WalletLedgerEntry.where(bill_order: order, entry_type: :debit).count).to eq(1)
    expect(WalletLedgerEntry.where(bill_order: order, entry_type: :release).count).to eq(0)

    service.run
    expect(WalletLedgerEntry.where(bill_order: order, entry_type: :debit).count).to eq(1)
  end

  it 'creates a release (no debit) for provider failure and is idempotent' do
    order = build_order
    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: order, amount: 100)

    service = service_with_status(:failed)
    service.run
    expect(WalletLedgerEntry.where(bill_order: order, entry_type: :release).count).to eq(1)
    expect(WalletLedgerEntry.where(bill_order: order, entry_type: :debit).count).to eq(0)

    service.run
    expect(WalletLedgerEntry.where(bill_order: order, entry_type: :release).count).to eq(1)
  end

  it 'makes no changes when provider is pending' do
    order = build_order
    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: order, amount: 100)

    pending_client = instance_double(BuyPowerPaymentService)
    allow(pending_client).to receive(:re_query).and_return(status: :ok, response: { 'data' => { 'status' => 'pending' } })

    described_class.new(commit: true, provider_client: pending_client).run
    expect(WalletLedgerEntry.where(bill_order: order, entry_type: :debit)).to be_empty
    expect(WalletLedgerEntry.where(bill_order: order, entry_type: :release)).to be_empty
  end

  it 'does not release when a debit already exists' do
    order = build_order
    seed_wallet
    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: order, amount: 100)
    WalletLedgerEntry.record_debit!(wallet: wallet, bill_order: order, amount: 100)

    service = service_with_status(:failed)
    service.run

    expect(WalletLedgerEntry.where(bill_order: order, entry_type: :release)).to be_empty
    expect(WalletLedgerEntry.where(bill_order: order, entry_type: :debit).count).to eq(1)
  end

  it 'does not debit when a release already exists' do
    order = build_order
    seed_wallet
    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: order, amount: 100)
    WalletLedgerEntry.release_hold!(wallet: wallet, bill_order: order, amount: 20)

    service = service_with_status(:success)
    service.run

    expect(WalletLedgerEntry.where(bill_order: order, entry_type: :debit)).to be_empty
    expect(WalletLedgerEntry.where(bill_order: order, entry_type: :release).count).to eq(1)
  end

  it 'skips debit when ledger balance is insufficient' do
    order = build_order
    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: order, amount: 100)

    service = service_with_status(:success)
    service.run

    expect(WalletLedgerEntry.where(bill_order: order, entry_type: :debit)).to be_empty
    expect(wallet.ledger_available_balance).to eq(0.to_d)
  end

  it 'restores available balance after release on failure' do
    order = build_order
    seed_wallet(200)
    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: order, amount: 100)
    expect(wallet.ledger_available_balance).to eq(100.to_d)

    service = service_with_status(:failed)
    service.run

    expect(WalletLedgerEntry.where(bill_order: order, entry_type: :release).count).to eq(1)
    expect(wallet.ledger_available_balance).to eq(200.to_d)
  end
end
