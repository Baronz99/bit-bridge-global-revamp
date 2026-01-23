# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'BillOrders wallet idempotency', type: :request do
  include AuthHelpers

  it 'does not double-debit on repeated idempotency key' do
    allow(Config::Bills).to receive(:validate!).and_return(true)
    allow(Config::Bills).to receive(:base_url).and_return('http://example.test')
    allow(Config::Bills).to receive(:token).and_return('token')

    provider_response = {
      'data' => { 'units' => '1', 'token' => 'abc', 'id' => 'txn_1' },
      'message' => 'OK'
    }
    def provider_response.success?
      true
    end

    allow(BuyPowerPaymentService).to receive(:post).and_return(provider_response)

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
      payment_method: 'wallet'
    )

    headers = auth_headers(user).merge('Idempotency-Key' => 'idem-1')
    headers['Idempotency-Key'] ||= SecureRandom.uuid
    params = { bill_order: { payment_method: 'wallet', use_commission: false } }

    patch "/api/v1/bill_orders/#{bill_order.id}/confirm_bill_payment", params: params, headers: headers
    expect(response).to have_http_status(:ok)

    entries_after_first = WalletLedgerEntry.where(bill_order: bill_order)
    debit_amount = entries_after_first.debit.first&.amount
    expect(entries_after_first.debit.count).to eq(1)

    patch "/api/v1/bill_orders/#{bill_order.id}/confirm_bill_payment", params: params, headers: headers
    expect(response).to have_http_status(:ok)

    entries = WalletLedgerEntry.where(bill_order: bill_order)
    expect(entries.count).to eq(2)
    expect(entries.debit.count).to eq(1)
    expect(entries.debit.first&.amount).to eq(debit_amount)
    expect(entries.hold.count).to eq(1)
    expect(entries.debit.count).to eq(1)
    expect(entries.release.count).to eq(0)
    expect(entries.refund.count).to eq(0)
  end
end
