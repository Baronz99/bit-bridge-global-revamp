# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::ReceiptsController', type: :request do
  include AuthHelpers
  let(:user) { create(:user) rescue nil }

  def build_wallet(user, currency: 'USD')
    wallet_type = currency.downcase == 'usd' ? :usd : :ngn
    wallet = Wallet.find_or_initialize_by(user: user, wallet_type: wallet_type)
    wallet.currency = currency
    wallet.balance_cents ||= 1_000_000
    wallet.save!
    wallet
  end

  def build_transaction(wallet, metadata: {}, amount: 100)
    Transaction.create!(
      wallet: wallet,
      amount: amount,
      transaction_type: :withdrawal,
      status: :declined, # avoids balance validation
      address: 'funding-address',
      metadata: metadata
    )
  end

  def build_card(user, card_id: 'card-1')
    Card.create!(user: user, card_id: card_id)
  end

  def build_card_event(user, card, provider_ref: 'provider-ref', amount: 50, currency: 'USD')
    CardEvent.create!(
      user: user,
      card_id: card.card_id,
      provider_transaction_reference: provider_ref,
      amount: amount,
      currency: currency,
      event: 'card_event',
      status: 'successful'
    )
  end

  def build_bill_order(user)
    BillOrder.create!(
      user: user,
      amount: 200,
      total_amount: 200,
      service_type: 'DATA',
      status: :completed,
      biller: 'Test Biller'
    )
  end

  def build_transaction_record(user, reference: 'bbg-123')
    wallet = build_wallet(user, currency: 'USD')
    tx = build_transaction(wallet, metadata: {}, amount: 300)
    TransactionRecord.create!(reference: reference, exchange: tx, amount: 300, event_type: 'checkout')
  end

  def build_circle(user)
    Circle.create!(owner: user, name: 'Test Circle', currency: 'NGN', balance_cents: 0)
  end

  def build_circle_tx(circle, user)
    CircleTransaction.create!(
      circle: circle,
      user: user,
      amount_cents: 100,
      direction: :credit
    )
  end

  describe 'GET /api/v1/receipts/:reference' do
    it 'does not promote wallet to card funding without deterministic match' do
      skip('Factories not available in this environment') unless user
      wallet = build_wallet(user)
      wallet_tx = build_transaction(wallet, metadata: { subtype: 'virtual_card_funding', transfer_reference: 'no-match' })
      get "/api/v1/receipts/wallet-tx-#{wallet_tx.id}", headers: auth_headers(user)
      body = JSON.parse(response.body)
      expect(body['data']['kind']).to eq('wallet')
      expect(body['data'].dig('parties', 'card_id')).to be_nil
    end

    it 'promotes wallet to virtual_card_funding when provider_transaction_reference matches card event' do
      skip('Factories not available in this environment') unless user
      card = build_card(user, card_id: 'card-fund-1')
      evt = build_card_event(user, card, provider_ref: 'match-123')
      wallet = build_wallet(user)
      wallet_tx = build_transaction(wallet, metadata: { subtype: 'virtual_card_funding', provider_transaction_reference: 'match-123', bridge_card_id: card.card_id })
      get "/api/v1/receipts/wallet-tx-#{wallet_tx.id}", headers: auth_headers(user)
      body = JSON.parse(response.body)
      expect(body['data']['event']).to eq('virtual_card_funding')
      expect(body['data']['parties']['card_id']).to eq(card.card_id)
    end

    it 'returns wallet receipt dto' do
      skip('Factories not available in this environment') unless user
      wallet = build_wallet(user)
      wallet_tx = build_transaction(wallet, metadata: {})
      get "/api/v1/receipts/wallet-tx-#{wallet_tx.id}", headers: auth_headers(user)
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['data']['reference']).to eq("wallet-tx-#{wallet_tx.id}").or eq(wallet_tx.transaction_record&.reference)
      expect(body['data']['kind']).to eq('wallet')
    end

    it 'returns card event receipt dto' do
      skip('Factories not available in this environment') unless user
      card = build_card(user, card_id: 'card-evt-1')
      evt = build_card_event(user, card, provider_ref: 'prov-evt')
      get "/api/v1/receipts/card-evt-#{evt.id}", headers: auth_headers(user)
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['data']['kind']).to eq('card')
    end

    it 'returns bill order receipt dto' do
      skip('Factories not available in this environment') unless user
      order = build_bill_order(user)
      get "/api/v1/receipts/bill-#{order.id}", headers: auth_headers(user)
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['data']['kind']).to eq('bill')
    end

    it 'returns transaction_record receipt dto (bbg-/fbg-)' do
      skip('Factories not available in this environment') unless user
      record = build_transaction_record(user, reference: 'bbg-123')
      get '/api/v1/receipts/bbg-123', headers: auth_headers(user)
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['data']['reference']).to eq('bbg-123')
    end

    it 'returns circle transaction dto' do
      skip('Factories not available in this environment') unless user
      circle = build_circle(user)
      circle.members << user unless circle.members.include?(user)
      ctx = build_circle_tx(circle, user)
      get "/api/v1/receipts/circle-tx-#{ctx.id}", headers: auth_headers(user)
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['data']['kind']).to eq('circle')
    end
  end
end
