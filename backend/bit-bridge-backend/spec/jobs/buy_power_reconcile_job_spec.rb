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
      status: 'processing',
      provider_reference: 'bp-ref-1'
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
      status: 'processing',
      provider_reference: 'bp-ref-2'
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
      status: 'processing',
      provider_reference: 'bp-ref-3'
    )

    allow_any_instance_of(BuyPowerPaymentService).to receive(:re_query)
      .and_return(status: :unprocessable_entity, response: 'error')

    expect { described_class.perform_now(bill_order.id) }
      .to have_enqueued_job(described_class)
  end

  it 'fails after max attempts when provider response is not ok' do
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
      status: 'processing',
      reason: nil,
      provider_reference: 'bp-ref-4',
      reconcile_attempts: BuyPowerReconcileJob::DEFAULT_MAX_ATTEMPTS - 1
    )

    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: bill_order, amount: 1000)
    WalletLedgerEntry.record_debit!(wallet: wallet, bill_order: bill_order, amount: 1000)

    allow_any_instance_of(BuyPowerPaymentService).to receive(:re_query)
      .and_return(status: :unprocessable_entity, response: 'error')

    expect { described_class.perform_now(bill_order.id) }
      .not_to have_enqueued_job(described_class)

    bill_order.reload
    expect(bill_order.status).to eq('failed')
    entries = WalletLedgerEntry.where(bill_order: bill_order)
    expect(entries.refund.count).to eq(1)
  end

  it 'falls back to the bill order id when provider references are blank' do
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
      status: 'processing',
      provider_reference: nil,
      transaction_id: nil
    )

    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: bill_order, amount: 1000)

    requery_response = {
      'result' => {
        'status' => true,
        'message' => 'Successful transaction',
        'data' => { 'id' => 'txn_fallback', 'units' => '1', 'token' => 'abc-123' }
      }
    }
    expect_any_instance_of(BuyPowerPaymentService).to receive(:re_query).with(bill_order.id.to_s)
      .and_return(status: :ok, response: requery_response)

    expect { described_class.perform_now(bill_order.id) }
      .not_to have_enqueued_job(described_class)

    bill_order.reload
    expect(bill_order.status).to eq('completed')
    expect(bill_order.provider_reference).to eq('txn_fallback')
    entries = WalletLedgerEntry.where(bill_order: bill_order)
    expect(entries.hold.count).to eq(1)
    expect(entries.release.count).to eq(1)
    expect(entries.debit.count).to eq(1)
    expect(entries.refund.count).to eq(0)
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

  it 'skips anchor transfer shadow orders' do
    allow(Config::Bills).to receive(:validate!).and_return(true)
    allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
    allow(Config::Bills).to receive(:token).and_return('token')

    service = BuyPowerPaymentService.new
    allow(BuyPowerPaymentService).to receive(:new).and_return(service)
    expect(service).not_to receive(:re_query)

    user = create(:user)
    bill_order = BillOrder.create!(
      user: user,
      meter_number: SecureRandom.uuid,
      meter_type: 'PREPAID',
      address: 'Anchor transfer hold',
      name: 'Anchor transfer',
      tariff_class: 'A',
      service_type: 'OTHER',
      email: user.email,
      amount: 1035,
      total_amount: 1035,
      phone: '0000000000',
      biller: 'Anchor',
      description: 'Anchor NGN transfer hold',
      payment_type: 'online',
      payment_method: 'wallet',
      status: 'processing',
      provider_response: { 'source' => 'anchor_transfer' }
    )

    expect { described_class.perform_now(bill_order.id) }
      .not_to have_enqueued_job(described_class)

    expect(bill_order.reload.status).to eq('processing')
  end
end

