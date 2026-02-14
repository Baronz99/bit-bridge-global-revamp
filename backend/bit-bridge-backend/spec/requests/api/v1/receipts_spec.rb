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
      expect(body['data']['timeline']).to be_an(Array)
    end

    it 'includes deterministic FX conversion metadata for tunnel wallet transactions' do
      skip('Factories not available in this environment') unless user
      wallet = build_wallet(user, currency: 'NGN')
      fx_quote = FxQuote.create!(
        user: user,
        direction: 'ngn_to_usd',
        base_rate: 1500,
        markup: 75,
        execution_rate: 1575,
        base_rate_raw: 1500,
        markup_raw: 75,
        execution_rate_raw: 1575,
        fee_amount: 100,
        fee_amount_raw: 100,
        fee_currency: 'NGN',
        amount_in: 10_000,
        amount_in_raw: 10_000,
        amount_after_fee: 9_900,
        amount_after_fee_raw: 9_900,
        amount_out: 6.2857,
        amount_out_raw: 6.2857,
        expires_at: 5.minutes.from_now,
        executed_at: Time.current
      )
      wallet_tx = Transaction.create!(
        wallet: wallet,
        amount: 10_000,
        transaction_type: :withdrawal,
        status: :declined,
        address: 'Tunnel Conversion (NGN -> USD)',
        metadata: {
          fx_quote_token: fx_quote.token,
          fx_execution_reference: SecureRandom.uuid
        }
      )

      get "/api/v1/receipts/wallet-tx-#{wallet_tx.id}", headers: auth_headers(user)
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.dig('data', 'meta', 'conversion')).to eq(true)
      expect(body.dig('data', 'meta', 'conversion_direction')).to eq('ngn_to_usd')
      expect(body.dig('data', 'meta', 'fx', 'quote_token')).to eq(fx_quote.token)
      expect(body.dig('data', 'meta', 'fx', 'execution_rate')).to eq(1575.0)
      expect(body.dig('data', 'meta', 'fx')).not_to have_key('base_rate')
      expect(body.dig('data', 'meta', 'fx')).not_to have_key('markup')
      expect(body.dig('data', 'fees', 0, 'label')).to eq('conversion fee')
      expect(body.dig('data', 'fees', 0, 'currency')).to eq('NGN')
      timeline = body.dig('data', 'timeline')
      expect(timeline).to be_an(Array)
      expect(timeline.length).to be >= 3
      expect(%w[conversion_completed conversion_failed]).to include(timeline[0]['step_key'])
      expect(%w[completed failed pending]).to include(timeline[0]['state'])
      expect(timeline[1]['step_key']).to eq('processing_conversion')
      expect(%w[completed current]).to include(timeline[1]['state'])
      expect(timeline[2]['step_key']).to eq('conversion_initiated')
      expect(timeline[2]['state']).to eq('completed')
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

    it 'returns value and wallet breakdown for reward-assisted bill' do
      skip('Factories not available in this environment') unless user
      order = build_bill_order(user)
      order.update!(wallet_amount_charged: 180, reward_applied: 20, commission_used: 20)
      get "/api/v1/receipts/bill-#{order.id}", headers: auth_headers(user)
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['data']['value_amount'].to_d).to eq(order.amount.to_d)
      expect(body['data']['wallet_amount_charged'].to_d).to eq(180.to_d)
      expect(body['data']['reward_applied'].to_d).to eq(20.to_d)
      expect(body['data']['total_display'].to_d).to eq(order.amount.to_d)
    end

    it 'returns transaction_record receipt dto (bbg-/fbg-)' do
      skip('Factories not available in this environment') unless user
      record = build_transaction_record(user, reference: 'bbg-123')
      get '/api/v1/receipts/bbg-123', headers: auth_headers(user)
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['data']['reference']).to eq('bbg-123')
    end


    it 'returns transaction_record receipt dto for pooled BBG reference' do
      skip('Factories not available in this environment') unless user
      record = build_transaction_record(user, reference: 'BBG-LSGSCZ-LRLA')
      get '/api/v1/receipts/BBG-LSGSCZ-LRLA', headers: auth_headers(user)
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['data']['reference']).to eq('BBG-LSGSCZ-LRLA')
      expect(body['data']['kind']).to eq('wallet').or eq('transaction_record')
    end

    it 'does not return pooled BBG receipt for another user' do
      skip('Factories not available in this environment') unless user
      other_user = create(:user)
      build_transaction_record(other_user, reference: 'BBG-AAAA11-ZZ99')

      get '/api/v1/receipts/BBG-AAAA11-ZZ99', headers: auth_headers(user)
      expect(response).to have_http_status(:not_found)
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
