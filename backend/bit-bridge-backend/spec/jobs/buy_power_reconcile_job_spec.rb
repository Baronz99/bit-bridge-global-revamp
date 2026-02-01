# frozen_string_literal: true

require 'rails_helper'

RSpec.describe BuyPowerReconcileJob, type: :job do
  include ActiveJob::TestHelper
  include ActiveSupport::Testing::TimeHelpers

  it 'is idempotent for successful reconciliation' do
    allow(Config::Bills).to receive(:validate!).and_return(true)
    allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
    allow(Config::Bills).to receive(:token).and_return('token')

    user = create(:user)
    wallet = user.wallet
    Transaction.create!(
      wallet: wallet,
      amount: 10_000,
      bonus: 0,
      status: :approved,
      transaction_type: :deposit
    )

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
      payment_method: 'wallet',
      status: 'processing'
    )

    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: bill_order, amount: 1000)
    starting_available = wallet.ledger_available_balance

    requery_response = {
      'data' => { 'status' => 'SUCCESS', 'units' => '1', 'token' => 'abc', 'id' => 'txn_1' },
      'message' => 'OK'
    }
    allow_any_instance_of(BuyPowerPaymentService).to receive(:re_query).and_return(status: :ok, response: requery_response)

    described_class.perform_now(bill_order.id)
    described_class.perform_now(bill_order.id)

    entries = WalletLedgerEntry.where(bill_order: bill_order)
    expect(entries.hold.count).to eq(1)
    expect(entries.release.count).to eq(1)
    expect(entries.debit.count).to eq(1)
    expect(bill_order.reload.status).to eq('completed')
    expect(wallet.reload.ledger_available_balance).to eq(starting_available)
  end

  it 'does not double-refund on repeated reconciliation' do
    allow(Config::Bills).to receive(:validate!).and_return(true)
    allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
    allow(Config::Bills).to receive(:token).and_return('token')

    user = create(:user)
    wallet = user.wallet
    Transaction.create!(
      wallet: wallet,
      amount: 10_000,
      bonus: 0,
      status: :approved,
      transaction_type: :deposit
    )

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
      payment_method: 'wallet',
      status: 'processing'
    )

    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: bill_order, amount: 1000)

    requery_response = {
      'data' => { 'status' => 'REFUNDED', 'id' => 'txn_2' },
      'message' => 'Refunded'
    }
    allow_any_instance_of(BuyPowerPaymentService).to receive(:re_query).and_return(status: :ok, response: requery_response)

    described_class.perform_now(bill_order.id)
    described_class.perform_now(bill_order.id)

    entries = WalletLedgerEntry.where(bill_order: bill_order)
    expect(entries.hold.count).to eq(1)
    expect(entries.release.count).to eq(1)
    expect(entries.refund.count).to eq(1)
    expect(bill_order.reload.status).to eq('refunded')
  end

  it 're-enqueues when provider response is not ok and order is non-terminal' do
    allow(Config::Bills).to receive(:validate!).and_return(true)
    allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
    allow(Config::Bills).to receive(:token).and_return('token')

    user = create(:user)
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
      payment_method: 'wallet',
      status: 'processing'
    )

    allow_any_instance_of(BuyPowerPaymentService).to receive(:re_query)
      .and_return(status: :unprocessable_entity, response: 'error')

    expect { described_class.perform_now(bill_order.id) }
      .to have_enqueued_job(described_class)
  end

  it 'does not re-enqueue stale non-ok responses and marks reason' do
    allow(Config::Bills).to receive(:validate!).and_return(true)
    allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
    allow(Config::Bills).to receive(:token).and_return('token')

    user = create(:user)
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
      payment_method: 'wallet',
      status: 'processing',
      reason: nil
    )
    bill_order.update_columns(updated_at: 3.hours.ago)

    allow_any_instance_of(BuyPowerPaymentService).to receive(:re_query)
      .and_return(status: :unprocessable_entity, response: 'error')

    expect { described_class.perform_now(bill_order.id) }
      .not_to have_enqueued_job(described_class)

    expect(bill_order.reload.reason).to include('Reconcile stalled')
  end

  it 'fails processing wallet order with provider error and releases hold' do
    allow(Config::Bills).to receive(:validate!).and_return(true)
    allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
    allow(Config::Bills).to receive(:token).and_return('token')

    service = BuyPowerPaymentService.new
    allow(BuyPowerPaymentService).to receive(:new).and_return(service)
    expect(service).not_to receive(:re_query)

    user = create(:user)
    wallet = user.wallet
    Transaction.create!(
      wallet: wallet,
      amount: 10_000,
      bonus: 0,
      status: :approved,
      transaction_type: :deposit
    )

    bill_order = BillOrder.create!(
      user: user,
      meter_number: '08012345678',
      meter_type: 'PREPAID',
      address: 'Test Address',
      name: 'Test User',
      tariff_class: 'A',
      service_type: 'ELECTRICITY',
      email: user.email,
      amount: 1000,
      total_amount: 1000,
      phone: '08012345678',
      biller: 'IKEDC',
      description: 'Electricity',
      payment_type: 'online',
      payment_method: 'wallet',
      status: 'processing',
      reason: 'Invalid Phone Number. Please Check.',
      provider_response: { 'error' => true, 'message' => 'Invalid Phone Number. Please Check.' }
    )

    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: bill_order, amount: bill_order.total_amount)

    described_class.perform_now(bill_order.id)

    expect(bill_order.reload.status).to eq('failed')
    expect(bill_order.reload.reason).to include('Invalid Phone Number')
    expect(WalletLedgerEntry.where(bill_order: bill_order).hold.count).to eq(1)
    expect(WalletLedgerEntry.where(bill_order: bill_order).release.count).to eq(1)
    expect(WalletLedgerEntry.where(bill_order: bill_order).debit.count).to eq(0)
    expect(WalletLedgerEntry.where(bill_order: bill_order).refund.count).to eq(0)
  end

  it 'is idempotent for hard provider error' do
    allow(Config::Bills).to receive(:validate!).and_return(true)
    allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
    allow(Config::Bills).to receive(:token).and_return('token')

    user = create(:user)
    wallet = user.wallet
    Transaction.create!(
      wallet: wallet,
      amount: 10_000,
      bonus: 0,
      status: :approved,
      transaction_type: :deposit
    )

    bill_order = BillOrder.create!(
      user: user,
      meter_number: '08012345678',
      meter_type: 'PREPAID',
      address: 'Test Address',
      name: 'Test User',
      tariff_class: 'A',
      service_type: 'ELECTRICITY',
      email: user.email,
      amount: 1000,
      total_amount: 1000,
      phone: '08012345678',
      biller: 'IKEDC',
      description: 'Electricity',
      payment_type: 'online',
      payment_method: 'wallet',
      status: 'processing',
      provider_response: { error: true, message: 'Invalid Phone Number. Please Check.' }
    )

    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: bill_order, amount: bill_order.total_amount)

    described_class.perform_now(bill_order.id)
    described_class.perform_now(bill_order.id)

    expect(WalletLedgerEntry.where(bill_order: bill_order).hold.count).to eq(1)
    expect(WalletLedgerEntry.where(bill_order: bill_order).release.count).to eq(1)
    expect(WalletLedgerEntry.where(bill_order: bill_order).debit.count).to eq(0)
    expect(WalletLedgerEntry.where(bill_order: bill_order).refund.count).to eq(0)
  end
end
