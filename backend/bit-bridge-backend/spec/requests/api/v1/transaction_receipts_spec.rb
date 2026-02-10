# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Transaction receipts', type: :request do
  include ActiveSupport::Testing::TimeHelpers

  let(:user) { create(:user, :tier2, :with_pin, email: "receipt-user-#{SecureRandom.hex(5)}@example.com") }
  let(:other_user) { create(:user, :tier2, :with_pin, email: "receipt-other-#{SecureRandom.hex(5)}@example.com") }
  let(:admin) { create(:user, role: 'super_admin', email: "receipt-admin-#{SecureRandom.hex(5)}@example.com") }

  def create_wallet_transaction(for_user:, amount: 100)
    wallet = for_user.ngn_wallet
    wallet.transactions.create!(
      transaction_type: :deposit,
      status: :approved,
      coin_type: :bank,
      amount: amount,
      address: 'Test funding'
    )
  end

  it 'returns receipt for own transaction' do
    tx = create_wallet_transaction(for_user: user, amount: 100)

    get "/api/v1/transactions/#{tx.id}/receipt", headers: auth_headers(user)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['data']['id']).to eq(tx.id)
    expect(body['data']['status']).to eq('approved')
  end

  it "does not allow fetching someone else's receipt" do
    tx = create_wallet_transaction(for_user: other_user, amount: 50)

    get "/api/v1/transactions/#{tx.id}/receipt", headers: auth_headers(user)

    expect(response).to have_http_status(:not_found)
  end

  it 'allows admin to fetch any receipt' do
    tx = create_wallet_transaction(for_user: other_user, amount: 75)

    get "/api/v1/transactions/#{tx.id}/receipt", headers: auth_headers(admin)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['data']['id']).to eq(tx.id)
  end

  it 'masks customer email and phone for non-admin' do
    tx = create_wallet_transaction(for_user: user, amount: 125)
    TransactionRecord.create!(
      exchange_id: tx.id,
      reference: 'fbg-111',
      status: 'pending',
      event_type: 'monnify.webhook.successful_transaction',
      email: 'user@example.com',
      phone_number: '08012345678'
    )

    get "/api/v1/transactions/#{tx.id}/receipt", headers: auth_headers(user)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    customer = body['data']['customer']
    expect(customer['email']).to include('***@')
    expect(customer['email']).not_to include('user@example.com')
    expect(customer['phone_number']).to include('*')
  end

  it 'shows full customer data for admin' do
    tx = create_wallet_transaction(for_user: other_user, amount: 125)
    TransactionRecord.create!(
      exchange_id: tx.id,
      reference: 'fbg-222',
      status: 'pending',
      event_type: 'monnify.webhook.successful_transaction',
      email: 'admin-view@example.com',
      phone_number: '08099887766'
    )

    get "/api/v1/transactions/#{tx.id}/receipt", headers: auth_headers(admin)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    customer = body['data']['customer']
    expect(customer['email']).to eq('admin-view@example.com')
    expect(customer['phone_number']).to eq('08099887766')
  end

  it 'returns timeline events in descending order' do
    tx = nil

    travel_to(3.days.ago) do
      tx = create_wallet_transaction(for_user: user, amount: 200)
    end

    travel_to(2.days.ago) do
      TransactionRecord.create!(
        exchange_id: tx.id,
        reference: 'fbg-333',
        status: 'pending',
        event_type: 'monnify.webhook.successful_transaction'
      )
    end

    travel_to(1.day.ago) do
      AnchorWebhookEvent.create!(
        reference: 'fbg-333',
        event_type: 'anchor.webhook.payment.settled',
        status: 'processed',
        received_at: Time.current
      )
    end

    get "/api/v1/transactions/#{tx.id}/receipt", headers: auth_headers(user)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    timeline = body['data']['timeline']
    expect(timeline.first['event_type']).to eq('anchor.webhook.payment.settled')
    expect(timeline.last['event_type']).to eq('wallet.transaction.created')
  end

  it 'returns anchor bank transfer details on receipt' do
    tx = create_wallet_transaction(for_user: user, amount: 1000)
    tx.update!(
      metadata: {
        provider: 'anchor',
        anchor_payment_id: '1770730762674302-anc_inb_trsf',
        anchor_payment_reference: '177068004048618-ref',
        anchor_narration: 'NIP Transfer test',
        anchor_sender: {
          account_number: '0210998196',
          account_name: 'OKAFOR CYRIL EMEKA',
          bank_name: 'GTBank Plc'
        },
        anchor_virtual_account: {
          account_number: '6178433884',
          account_name: 'Okafor Cyril'
        },
        anchor_settlement_account_id: '17706800403623-anc_acc'
      }
    )
    TransactionRecord.create!(
      exchange_id: tx.id,
      reference: '177068004048618-ref',
      status: 'approved',
      event_type: 'anchor.webhook.payment.settled'
    )

    get "/api/v1/transactions/#{tx.id}/receipt", headers: auth_headers(user)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body.dig('data', 'provider', 'name')).to eq('anchor')
    expect(body.dig('data', 'provider', 'payment_id')).to eq('1770730762674302-anc_inb_trsf')
    expect(body.dig('data', 'provider', 'reference')).to eq('177068004048618-ref')
    expect(body.dig('data', 'parties', 'sender_bank_name')).to eq('GTBank Plc')
    expect(body.dig('data', 'parties', 'sender_account_number')).to eq('0210998196')
    expect(body.dig('data', 'parties', 'beneficiary_account_number')).to eq('6178433884')
  end
end
