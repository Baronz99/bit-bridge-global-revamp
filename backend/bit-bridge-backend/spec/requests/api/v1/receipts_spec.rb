# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Receipts', type: :request do
  let(:user) { create(:user, :tier2, :with_pin) }

  it 'does not resolve receipts by transaction id' do
    tx = user.ngn_wallet.transactions.create!(
      transaction_type: :deposit,
      status: :approved,
      coin_type: :bank,
      amount: 50,
      address: 'Test funding'
    )

    get "/api/v1/receipts/placeholder", params: { reference: tx.id }, headers: auth_headers(user)

    expect(response).to have_http_status(:not_found)
  end

  it 'returns legacy receipt for transaction record without exchange' do
    TransactionRecord.create!(
      reference: 'bbg-123456',
      status: 'pending',
      event_type: 'checkout.init',
      amount: 125.5
    )

    get '/api/v1/receipts/bbg-123456', headers: auth_headers(user)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['data']['reference']).to eq('bbg-123456')
    expect(body['data']['type']).to eq('checkout')
  end

  it 'returns receipt for transaction record with exchange' do
    tx = user.ngn_wallet.transactions.create!(
      transaction_type: :deposit,
      status: :approved,
      coin_type: :bank,
      amount: 75,
      address: 'Test funding'
    )
    TransactionRecord.create!(
      exchange_id: tx.id,
      reference: 'fbg-98765',
      status: 'pending',
      event_type: 'monnify.webhook.successful_transaction'
    )

    get '/api/v1/receipts/fbg-98765', headers: auth_headers(user)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['data']['type']).to eq('wallet')
    expect(body['data']['status']).to eq('approved')
  end

  it 'renders bill order receipt even when currency method is missing' do
    order = BillOrder.create!(
      user: user,
      service_type: 'VTU',
      amount: 1500,
      total_amount: 1500,
      meter_number: "1234567890",
      status: :completed,
      meter_type: :PREPAID,
      payment_method: :wallet,
      payment_type: :online
    )

    TransactionRecord.create!(
      reference: 'bbg-776655',
      status: 'completed',
      event_type: 'bill_order.checkout_init',
      bill_order: order
    )

    get '/api/v1/receipts/bbg-776655', headers: auth_headers(user)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['data']['type']).to eq('bill')
    expect(body['data']['currency']).to eq('NGN')
  end
end
