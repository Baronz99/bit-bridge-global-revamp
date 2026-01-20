# frozen_string_literal: true

require 'rails_helper'

RSpec.describe BuyPowerReconcileJob, type: :job do
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
end
