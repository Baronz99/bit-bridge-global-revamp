# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'BillPaymentIntents', type: :request do
  include AuthHelpers

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

  it 'creates an intent from bill order and executes wallet flow' do
    user = create(:user, :confirmed)
    wallet = user.wallet
    Transaction.create!(wallet: wallet, amount: 10_000, bonus: 0, status: :approved, transaction_type: :deposit)
    bill_order = create_bill_order(user: user, amount: 1000)
    headers = auth_headers(user)

    post '/api/v1/bill_payment_intents', params: { bill_order_id: bill_order.id }, headers: headers
    expect(response).to have_http_status(:ok)
    intent_id = response.parsed_body.dig('data', 'id')
    expect(intent_id).to be_present

    service = instance_double(BuyPowerPaymentService)
    allow(BuyPowerPaymentService).to receive(:new).and_return(service)
    allow(service).to receive(:confirm_subscription) do |order, *_args, **_kwargs|
      order.update!(status: :completed, provider_reference: 'provider-req')
      BillOrders::Finalizer.call(bill_order: order)
      { status: 'success', response: order }
    end

    post "/api/v1/bill_payment_intents/#{intent_id}/execute", headers: headers
    expect(response).to have_http_status(:ok)
    body = response.parsed_body
    expect(body['success']).to eq(true)
    expect(body.dig('intent', 'status')).to eq('completed')
  end
end
