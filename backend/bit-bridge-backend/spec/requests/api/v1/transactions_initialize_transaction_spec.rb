# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Transactions initialize transaction', type: :request do
  let(:user) { create(:user) }
  let(:headers) { auth_headers(user) }

  around do |example|
    original = ENV.to_h
    ENV['MONNIFY_API_KEY'] = nil
    ENV['MONNIFY_SECRET_KEY'] = nil
    ENV['MONNIFY_CONTRACT_CODE'] = nil
    example.run
    ENV.replace(original)
  end

  it 'returns 422 with a clear message when Monnify env is missing' do
    post '/api/v1/transactions/initialize_transaction',
         params: {
           transaction: {
             amount: 1000,
             transaction_type: 'deposit',
             customer_name: 'Test User',
             email: 'test@example.com',
             description: 'Test payment',
             payment_purpose: 'wallet_topup'
           }
         },
         headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body['message']).to match(/Missing MONNIFY_/)
  end

  it 'creates a pending transaction record on success' do
    service_response = {
      status: :ok,
      response: { 'responseBody' => { 'paymentReference' => 'fbg-123' } }
    }
    service_double = instance_double(PaymentService, init_transaction: service_response)
    allow(PaymentService).to receive(:new).and_return(service_double)

    post '/api/v1/transactions/initialize_transaction',
         params: {
           transaction: {
             amount: 1000,
             transaction_type: 'deposit',
             customer_name: 'Test User',
             email: 'test@example.com',
             description: 'Test payment',
             payment_purpose: 'wallet_topup'
           }
         },
         headers: headers

    expect(response).to have_http_status(:ok)
    record = TransactionRecord.find_by(reference: 'fbg-123')
    expect(record).to be_present
    expect(record.status).to eq('pending')
    expect(record.event_type).to eq('checkout.init')
  end
end
