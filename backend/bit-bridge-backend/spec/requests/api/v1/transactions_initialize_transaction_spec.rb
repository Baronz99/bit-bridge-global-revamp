# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Transactions initialize transaction', type: :request do
  let(:user) { create(:user, :confirmed) }
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

  it 'initializes anchor pay-with-transfer and does not credit immediately' do
    anchor_response = {
      status: :ok,
      details: {
        bank_name: 'Anchor MFB',
        account_number: '0123456789',
        account_name: 'BitBridge Checkout',
        expiry_time: '2026-02-14T10:00:00Z',
        provider_reference: 'payin_123'
      }
    }
    anchor_double = instance_double(AnchorService, create_pay_with_transfer: anchor_response)
    allow(AnchorService).to receive(:new).and_return(anchor_double)

    post '/api/v1/transactions/initialize_transaction',
         params: {
           transaction: {
             amount: 2500,
             transaction_type: 'deposit',
             customer_name: 'Test User',
             email: 'test@example.com',
             description: 'Wallet funding',
             payment_purpose: 'wallet_topup',
             provider: 'anchor'
           }
         },
         headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    response_body = body.fetch('responseBody')
    expect(response_body['provider']).to eq('anchor')
    expect(response_body['accountNumber']).to eq('0123456789')
    expect(response_body['bankName']).to eq('Anchor MFB')

    record = TransactionRecord.find_by(reference: response_body['paymentReference'])
    expect(record).to be_present
    expect(record.status).to eq('pending')
    expect(record.event_type).to eq('checkout.init')
    expect(record.exchange).to be_present
    expect(record.exchange.status).to eq('initialized')
    expect(record.exchange.transaction_type).to eq('deposit')
    expect(record.transaction_id).to eq('payin_123')
  end

  it 'forces deposit transaction_type for anchor provider even if client sends withdrawal' do
    anchor_response = {
      status: :ok,
      details: {
        bank_name: 'Anchor MFB',
        account_number: '0123456789',
        account_name: 'BitBridge Checkout',
        expiry_time: '2026-02-14T10:00:00Z',
        provider_reference: 'payin_124'
      }
    }
    anchor_double = instance_double(AnchorService, create_pay_with_transfer: anchor_response)
    allow(AnchorService).to receive(:new).and_return(anchor_double)

    post '/api/v1/transactions/initialize_transaction',
         params: {
           transaction: {
             amount: 2500,
             transaction_type: 'withdrawal',
             customer_name: 'Test User',
             email: 'test@example.com',
             description: 'Wallet funding',
             payment_purpose: 'wallet_topup',
             provider: 'anchor'
           }
         },
         headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    record = TransactionRecord.find_by(reference: body.dig('responseBody', 'paymentReference'))
    expect(record).to be_present
    expect(record.exchange.transaction_type).to eq('deposit')
  end
end
