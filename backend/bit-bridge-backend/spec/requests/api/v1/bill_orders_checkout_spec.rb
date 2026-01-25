# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'BillOrders checkout init', type: :request do
  include AuthHelpers

  it 'sets payment_method to card when initializing checkout' do
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
      payment_type: 'online'
    )

    service_response = {
      status: :ok,
      response: { 'responseBody' => { 'paymentReference' => 'bbg-123' } }
    }
    service_double = instance_double(PaymentService, init_transaction: service_response)
    allow(PaymentService).to receive(:new).and_return(service_double)

    headers = auth_headers(user)
    get "/api/v1/bill_orders/#{bill_order.id}/initialize_confirm_payment",
        params: { payment_method: 'card' },
        headers: headers

    expect(response).to have_http_status(:ok)
    expect(bill_order.reload.payment_method).to eq('card')
    record = TransactionRecord.find_by(reference: 'bbg-123')
    expect(record).to be_present
    expect(record.status).to eq('pending')
  end

  it 'does not change payment_method once processing' do
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

    service_response = {
      status: :ok,
      response: { 'responseBody' => { 'paymentReference' => 'bbg-123' } }
    }
    service_double = instance_double(PaymentService, init_transaction: service_response)
    allow(PaymentService).to receive(:new).and_return(service_double)

    headers = auth_headers(user)
    get "/api/v1/bill_orders/#{bill_order.id}/initialize_confirm_payment",
        params: { payment_method: 'card' },
        headers: headers

    expect(response).to have_http_status(:ok)
    expect(bill_order.reload.payment_method).to eq('wallet')
  end
end
