# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'BillOrders wallet-only init', type: :request do
  include AuthHelpers

  it 'blocks card checkout initialization for bills' do
    user = create(:user, :confirmed)
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
      payment_type: 'online'
    )

    headers = auth_headers(user)
    get "/api/v1/bill_orders/#{bill_order.id}/initialize_confirm_payment",
        params: { payment_method: 'card' },
        headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
    body = response.parsed_body
    expect(body['error_code']).to eq('WALLET_ONLY_BILLS')
    expect(bill_order.reload.payment_method).not_to eq('card')
    expect(TransactionRecord.where(bill_order_id: bill_order.id).count).to eq(0)
  end

  it 'returns bill payment intent when initializing wallet flow' do
    user = create(:user, :confirmed)
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
      status: 'initialized'
    )

    headers = auth_headers(user)
    get "/api/v1/bill_orders/#{bill_order.id}/initialize_confirm_payment",
        params: { payment_method: 'wallet' },
        headers: headers

    expect(response).to have_http_status(:ok)
    body = response.parsed_body
    expect(body['intent']).to be_present
    expect(body['intent']['bill_order_id']).to eq(bill_order.id)
    expect(bill_order.reload.payment_method).to eq('wallet')
  end
end
