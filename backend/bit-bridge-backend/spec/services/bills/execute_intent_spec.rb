# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Bills::ExecuteIntent, type: :service do
  include ActiveSupport::Testing::TimeHelpers
  include ActiveJob::TestHelper

  before do
    allow(Config::Bills).to receive(:validate!).and_return(true)
    allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
    allow(Config::Bills).to receive(:token).and_return('token')
  end

  def create_bill_order(user:, amount:)
    BillOrder.create!(
      user: user,
      meter_number: '08012345678',
      meter_type: 'PREPAID',
      address: 'Test Address',
      name: 'Test User',
      tariff_class: 'A',
      service_type: 'ELECTRICITY',
      email: user.email,
      amount: amount,
      phone: '08012345678',
      biller: 'ikeja',
      description: 'Electricity',
      payment_type: 'online',
      payment_method: 'wallet'
    )
  end

  it 'marks intent awaiting_funds when wallet balance is insufficient' do
    user = create(:user)
    bill_order = create_bill_order(user: user, amount: 5000)
    intent = BillPaymentIntent.find_or_create_for_bill_order!(bill_order: bill_order)

    result = described_class.call(intent: intent, request_id: 'req-1')

    expect(result[:http_status]).to eq(:unprocessable_entity)
    expect(result.dig(:body, :error_code)).to eq('INSUFFICIENT_FUNDS')
    expect(intent.reload.status).to eq('awaiting_funds')
    expect(WalletLedgerEntry.where(bill_order: bill_order).count).to eq(0)
  end

  it 'creates hold then settles debit and completes intent on provider success' do
    user = create(:user)
    wallet = user.wallet
    Transaction.create!(wallet: wallet, amount: 20_000, bonus: 0, status: :approved, transaction_type: :deposit)
    bill_order = create_bill_order(user: user, amount: 1000)
    intent = BillPaymentIntent.find_or_create_for_bill_order!(bill_order: bill_order)
    before_available = wallet.ledger_available_balance.to_d

    service = instance_double(BuyPowerPaymentService)
    allow(BuyPowerPaymentService).to receive(:new).and_return(service)
    allow(service).to receive(:confirm_subscription) do |order, *_args, **_kwargs|
      order.update!(status: :completed, provider_reference: 'provider-1')
      BillOrders::Finalizer.call(bill_order: order)
      { status: 'success', response: order }
    end

    result = described_class.call(intent: intent, request_id: 'req-2')

    expect(result[:http_status]).to eq(:ok)
    expect(intent.reload.status).to eq('completed')
    expect(bill_order.reload.status).to eq('completed')
    expect(WalletLedgerEntry.where(bill_order: bill_order, entry_type: :hold).count).to eq(1)
    expect(WalletLedgerEntry.where(bill_order: bill_order, entry_type: :debit).count).to eq(1)
    expect(wallet.reload.ledger_available_balance.to_d).to eq(before_available - intent.total.to_d)
    totals = WalletLedgerEntry.ledger_totals(wallet: wallet, bill_order: bill_order)
    expect(totals[:hold] - totals[:release] - totals[:debit]).to eq(0.to_d)
  end

  it 'releases hold and marks failed on provider failure' do
    user = create(:user)
    wallet = user.wallet
    Transaction.create!(wallet: wallet, amount: 20_000, bonus: 0, status: :approved, transaction_type: :deposit)
    bill_order = create_bill_order(user: user, amount: 1000)
    intent = BillPaymentIntent.find_or_create_for_bill_order!(bill_order: bill_order)

    service = instance_double(BuyPowerPaymentService)
    allow(BuyPowerPaymentService).to receive(:new).and_return(service)
    allow(service).to receive(:confirm_subscription) do |order, *_args, **_kwargs|
      WalletLedgerEntry.release_hold!(
        wallet: order.user.wallet,
        bill_order: order,
        amount: order.total_amount.to_d,
        reference: 'intent-failure'
      )
      order.update!(status: :failed)
      { status: 'error', response: 'Provider unavailable' }
    end

    result = described_class.call(intent: intent, request_id: 'req-3')

    expect(result[:http_status]).to eq(:unprocessable_entity)
    expect(intent.reload.status).to eq('failed')
    expect(bill_order.reload.status).to eq('failed')
    expect(WalletLedgerEntry.where(bill_order: bill_order, entry_type: :hold).count).to eq(1)
    expect(WalletLedgerEntry.where(bill_order: bill_order, entry_type: :release).count).to eq(1)
    expect(WalletLedgerEntry.where(bill_order: bill_order, entry_type: :debit).count).to eq(0)
  end

  it 'keeps hold on pending and completes later via reconcile job' do
    user = create(:user)
    wallet = user.wallet
    Transaction.create!(wallet: wallet, amount: 20_000, bonus: 0, status: :approved, transaction_type: :deposit)
    bill_order = create_bill_order(user: user, amount: 1000)
    intent = BillPaymentIntent.find_or_create_for_bill_order!(bill_order: bill_order)

    service = instance_double(BuyPowerPaymentService)
    allow(BuyPowerPaymentService).to receive(:new).and_return(service)
    allow(service).to receive(:confirm_subscription) do |order, *_args, **_kwargs|
      order.update!(status: :processing)
      { status: 'pending', response: 'Payment processing...' }
    end

    clear_enqueued_jobs
    pending_result = described_class.call(intent: intent, request_id: 'req-4')
    expect(pending_result[:http_status]).to eq(:accepted)
    expect(intent.reload.status).to eq('processing')
    expect(bill_order.reload.status).to eq('processing')
    expect(WalletLedgerEntry.where(bill_order: bill_order, entry_type: :hold).count).to eq(1)
    expect(WalletLedgerEntry.where(bill_order: bill_order, entry_type: :debit).count).to eq(0)
    expect(enqueued_jobs.any? { |job| job[:job] == BuyPowerReconcileJob && job[:args] == [bill_order.id] }).to eq(true)

    allow(BuyPowerPaymentService).to receive(:new).and_call_original
    requery_response = {
      'status' => 'success',
      'result' => {
        'status' => true,
        'data' => { 'id' => 'provider-2', 'units' => '2', 'token' => 'token-2', 'responseMessage' => 'Completed' }
      }
    }
    allow_any_instance_of(BuyPowerPaymentService).to receive(:re_query).and_return(status: :ok, response: requery_response)

    BuyPowerReconcileJob.perform_now(bill_order.id)

    expect(bill_order.reload.status).to eq('completed')
    expect(intent.reload.status).to eq('completed')
    expect(WalletLedgerEntry.where(bill_order: bill_order, entry_type: :debit).count).to eq(1)
  end

  it 'does not short-circuit before provider call for initialized bill orders' do
    user = create(:user)
    wallet = user.wallet
    Transaction.create!(wallet: wallet, amount: 20_000, bonus: 0, status: :approved, transaction_type: :deposit)
    bill_order = create_bill_order(user: user, amount: 1000)
    intent = BillPaymentIntent.find_or_create_for_bill_order!(bill_order: bill_order)

    service = instance_double(BuyPowerPaymentService)
    allow(BuyPowerPaymentService).to receive(:new).and_return(service)
    expect(service).to receive(:confirm_subscription).once.and_return(
      { status: 'pending', response: 'Payment processing...' }
    )

    result = described_class.call(intent: intent, request_id: 'req-provider-call')
    expect(result[:http_status]).to eq(:accepted)
  end

  it 'repairs mismatched or released hold before execution' do
    user = create(:user)
    wallet = user.wallet
    Transaction.create!(wallet: wallet, amount: 20_000, bonus: 0, status: :approved, transaction_type: :deposit)
    bill_order = create_bill_order(user: user, amount: 1000)
    intent = BillPaymentIntent.find_or_create_for_bill_order!(bill_order: bill_order)

    WalletLedgerEntry.ensure_hold!(wallet: wallet, bill_order: bill_order, amount: 500, reference: 'old-hold')
    WalletLedgerEntry.release_hold!(wallet: wallet, bill_order: bill_order, amount: 500, reference: 'old-release')

    service = instance_double(BuyPowerPaymentService)
    allow(BuyPowerPaymentService).to receive(:new).and_return(service)
    allow(service).to receive(:confirm_subscription) do |order, *_args, **_kwargs|
      order.update!(status: :processing)
      { status: 'pending', response: 'Payment processing...' }
    end

    result = described_class.call(intent: intent, request_id: 'req-repair')
    expect(result[:http_status]).to eq(:accepted)

    hold = WalletLedgerEntry.where(wallet: wallet, bill_order: bill_order, entry_type: :hold).order(created_at: :desc).first
    expect(hold.amount.to_d).to eq(intent.total.to_d)
    expect(hold.metadata['hold_repaired']).to eq(true)
    expect(WalletLedgerEntry.where(wallet: wallet, bill_order: bill_order, entry_type: :release).count).to eq(0)
  end

  it 'marks late completion metadata when provider completes after expiry via reconcile' do
    user = create(:user)
    wallet = user.wallet
    Transaction.create!(wallet: wallet, amount: 20_000, bonus: 0, status: :approved, transaction_type: :deposit)
    bill_order = create_bill_order(user: user, amount: 1000)
    intent = BillPaymentIntent.find_or_create_for_bill_order!(bill_order: bill_order)
    intent.update!(expires_at: 2.minutes.from_now)

    service = instance_double(BuyPowerPaymentService)
    allow(BuyPowerPaymentService).to receive(:new).and_return(service)
    allow(service).to receive(:confirm_subscription) do |order, *_args, **_kwargs|
      order.update!(status: :processing)
      { status: 'pending', response: 'Payment processing...' }
    end

    pending_result = described_class.call(intent: intent, request_id: 'req-late')
    expect(pending_result[:http_status]).to eq(:accepted)

    allow(BuyPowerPaymentService).to receive(:new).and_call_original
    requery_response = {
      'status' => 'success',
      'result' => {
        'status' => true,
        'data' => { 'id' => 'provider-late', 'units' => '2', 'token' => 'token-late', 'responseMessage' => 'Completed' }
      }
    }
    allow_any_instance_of(BuyPowerPaymentService).to receive(:re_query).and_return(status: :ok, response: requery_response)

    travel_to 3.minutes.from_now do
      BuyPowerReconcileJob.perform_now(bill_order.id)
    end

    metadata = intent.reload.metadata
    expect(intent.status).to eq('completed')
    expect(metadata['late']).to eq(true)
    expect(metadata['late_completed_at']).to be_present
  end

  it 'is idempotent for repeated execute calls' do
    user = create(:user)
    wallet = user.wallet
    Transaction.create!(wallet: wallet, amount: 20_000, bonus: 0, status: :approved, transaction_type: :deposit)
    bill_order = create_bill_order(user: user, amount: 1000)
    intent = BillPaymentIntent.find_or_create_for_bill_order!(bill_order: bill_order)

    service = instance_double(BuyPowerPaymentService)
    allow(BuyPowerPaymentService).to receive(:new).and_return(service)
    allow(service).to receive(:confirm_subscription) do |order, *_args, **_kwargs|
      order.update!(status: :completed, provider_reference: 'provider-3')
      BillOrders::Finalizer.call(bill_order: order)
      { status: 'success', response: order }
    end

    first = described_class.call(intent: intent, request_id: 'req-5')
    second = described_class.call(intent: intent, request_id: 'req-6')

    expect(first[:http_status]).to eq(:ok)
    expect(second[:http_status]).to eq(:ok)
    expect(second.dig(:body, :message)).to eq('Bill payment already completed')
    expect(WalletLedgerEntry.where(bill_order: bill_order, entry_type: :hold).count).to eq(1)
    expect(WalletLedgerEntry.where(bill_order: bill_order, entry_type: :debit).count).to eq(1)
  end

  it 'does not create a second debit after pending execute, reconcile success, then re-execute' do
    user = create(:user)
    wallet = user.wallet
    Transaction.create!(wallet: wallet, amount: 20_000, bonus: 0, status: :approved, transaction_type: :deposit)
    bill_order = create_bill_order(user: user, amount: 1000)
    intent = BillPaymentIntent.find_or_create_for_bill_order!(bill_order: bill_order)

    service = instance_double(BuyPowerPaymentService)
    allow(BuyPowerPaymentService).to receive(:new).and_return(service)
    allow(service).to receive(:confirm_subscription) do |order, *_args, **_kwargs|
      order.update!(status: :processing, provider_reference: 'provider-exactly-once')
      { status: 'pending', response: 'Payment processing...' }
    end

    first = described_class.call(intent: intent, request_id: 'req-once-1')
    expect(first[:http_status]).to eq(:accepted)
    expect(WalletLedgerEntry.where(bill_order: bill_order, entry_type: :debit).count).to eq(0)

    allow(BuyPowerPaymentService).to receive(:new).and_call_original
    requery_response = {
      'status' => 'success',
      'result' => {
        'status' => true,
        'data' => { 'id' => 'provider-exactly-once', 'units' => '2', 'token' => 'token-exactly-once', 'responseMessage' => 'Completed' }
      }
    }
    allow_any_instance_of(BuyPowerPaymentService).to receive(:re_query).and_return(status: :ok, response: requery_response)

    BuyPowerReconcileJob.perform_now(bill_order.id)
    expect(bill_order.reload.status).to eq('completed')
    expect(intent.reload.status).to eq('completed')
    expect(WalletLedgerEntry.where(bill_order: bill_order, entry_type: :debit).count).to eq(1)

    second = described_class.call(intent: intent.reload, request_id: 'req-once-2')
    expect(second[:http_status]).to eq(:ok)
    expect(second.dig(:body, :message)).to eq('Bill payment already completed')
    expect(WalletLedgerEntry.where(bill_order: bill_order, entry_type: :debit).count).to eq(1)
  end
end
