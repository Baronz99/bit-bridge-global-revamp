# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Cards setup card flow', type: :request do
  let(:user) { create(:user, :tier2, :confirmed) }
  let(:headers) { auth_headers(user) }
  let(:cache_store) { ActiveSupport::Cache::MemoryStore.new }

  around do |example|
    original = ENV.to_h
    original_cache = Rails.cache
    ENV['ENABLE_BRIDGE_CARDS'] = 'true'
    Rails.instance_variable_set(:@cache, cache_store)
    Rails.cache.clear
    example.run
    Rails.cache.clear
    Rails.instance_variable_set(:@cache, original_cache)
    ENV.replace(original)
  end

  describe 'POST /api/v1/cards/setup_card' do
    it 'requires idempotency key header' do
      post '/api/v1/cards/setup_card', params: { card: { card_pin: '1234' } }, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['error_code']).to eq('CARD_SETUP_VALIDATION_FAILED')
      expect(body['message']).to match(/X-Idempotency-Key/i)
    end

    it 'returns active when card already exists' do
      card = Card.create!(
        user: user,
        cardholder_id: 'cardholder-1',
        card_id: 'provider-card-1',
        status: 'active',
        meta_data: { 'cardholder_kyc_status' => 'verified' }
      )

      request_headers = headers.merge('X-Idempotency-Key' => SecureRandom.uuid)
      post '/api/v1/cards/setup_card', params: { card: { card_pin: '1234' } }, headers: request_headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['success']).to eq(true)
      expect(body['state']).to eq('active')
      expect(body.dig('data', 'card_id')).to eq(card.id)
      expect(body.dig('data', 'provider_card_id')).to eq('provider-card-1')
    end

    it 'returns idempotency conflict when same key is reused with different payload' do
      Card.create!(
        user: user,
        cardholder_id: 'cardholder-2',
        card_id: 'provider-card-2',
        status: 'active',
        meta_data: { 'cardholder_kyc_status' => 'verified' }
      )

      idempotency_key = SecureRandom.uuid
      request_headers = headers.merge('X-Idempotency-Key' => idempotency_key)

      post '/api/v1/cards/setup_card', params: { card: { card_pin: '1234', card_limit: '5000' } }, headers: request_headers
      expect(response).to have_http_status(:ok)

      post '/api/v1/cards/setup_card', params: { card: { card_pin: '1234', card_limit: '10000' } }, headers: request_headers

      expect(response).to have_http_status(:conflict)
      body = JSON.parse(response.body)
      expect(body['error_code']).to eq('CARD_SETUP_IDEMPOTENCY_CONFLICT')
    end

    it 'returns insufficient balance for verified cardholder without enough USD balance' do
      Card.create!(
        user: user,
        cardholder_id: 'cardholder-3',
        status: 'pending',
        meta_data: { 'cardholder_kyc_status' => 'verified' }
      )
      Wallet.create!(user: user, wallet_type: :usd, currency: 'USD', balance_cents: 200)

      request_headers = headers.merge('X-Idempotency-Key' => SecureRandom.uuid)
      post '/api/v1/cards/setup_card', params: { card: { card_pin: '1234', card_limit: '5000' } }, headers: request_headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['state']).to eq('insufficient_balance')
      expect(body['next_action']).to eq('top_up_wallet')
      expect(body.dig('data', 'pricing', 'required_total_usd')).to be > 0
      expect(body.dig('data', 'shortfall_usd')).to be > 0
    end

    it 'allows setup when wallet covers only creation fee and requested funding is zero' do
      Card.create!(
        user: user,
        cardholder_id: 'cardholder-5',
        status: 'pending',
        meta_data: { 'cardholder_kyc_status' => 'verified' }
      )
      Wallet.create!(user: user, wallet_type: :usd, currency: 'USD', balance_cents: 400)

      service_double = instance_double(BridgeCardService)
      allow(BridgeCardService).to receive(:new).and_return(service_double)
      allow(service_double).to receive(:create_card).and_return({
        status: :ok,
        message: 'Card created.',
        data: nil
      })

      request_headers = headers.merge('X-Idempotency-Key' => SecureRandom.uuid)
      post '/api/v1/cards/setup_card', params: { card: { card_pin: '1234', card_limit: '5000', requested_funding_usd: 0 } }, headers: request_headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['state']).not_to eq('insufficient_balance')
      expect(body.dig('data', 'pricing', 'required_total_usd')).to eq(4.0)
      expect(body.dig('data', 'pricing', 'min_funding_usd')).to eq(3.0)
      expect(body.dig('data', 'pricing', 'requested_funding_usd')).to eq(0.0)
    end

    it 'returns insufficient balance when wallet cannot cover creation fee alone' do
      Card.create!(
        user: user,
        cardholder_id: 'cardholder-6',
        status: 'pending',
        meta_data: { 'cardholder_kyc_status' => 'verified' }
      )
      Wallet.create!(user: user, wallet_type: :usd, currency: 'USD', balance_cents: 399)

      request_headers = headers.merge('X-Idempotency-Key' => SecureRandom.uuid)
      post '/api/v1/cards/setup_card', params: { card: { card_pin: '1234', card_limit: '5000', requested_funding_usd: 0 } }, headers: request_headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['state']).to eq('insufficient_balance')
      expect(body.dig('data', 'pricing', 'required_total_usd')).to eq(4.0)
      expect(body.dig('data', 'shortfall_usd')).to eq(0.01)
    end
  end

  describe 'GET /api/v1/cards/setup_status' do
    it 'returns not_started when user has no cardholder record' do
      get '/api/v1/cards/setup_status', headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['state']).to eq('not_started')
      expect(body['next_action']).to eq('start_setup')
    end

    it 'returns cardholder_pending when verification is in progress' do
      Card.create!(
        user: user,
        cardholder_id: 'cardholder-4',
        status: 'pending_verification',
        meta_data: { 'cardholder_kyc_status' => 'pending_verification' }
      )

      get '/api/v1/cards/setup_status', headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['state']).to eq('cardholder_pending')
      expect(body['next_action']).to eq('wait_webhook')
    end
  end
end
