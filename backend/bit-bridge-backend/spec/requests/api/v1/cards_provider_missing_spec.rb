# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Cards provider-missing reconciliation', type: :request do
  let(:user) { create(:user, :tier2, :confirmed) }
  let(:headers) { auth_headers(user) }

  around do |example|
    original = ENV.to_h
    ENV['ENABLE_BRIDGE_CARDS'] = 'true'
    example.run
    ENV.replace(original)
  end

  describe 'GET /api/v1/cards/user_card' do
    it 'excludes provider-missing cards from the latest card lookup' do
      active_card = Card.create!(user: user, card_id: 'provider-active-1', status: 'active')
      Card.create!(user: user, card_id: 'provider-missing-1', status: 'provider_missing')

      get '/api/v1/cards/user_card', headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.dig('data', 'id')).to eq(active_card.id)
      expect(body.dig('data', 'status')).to eq('active')
    end
  end

  describe 'GET /api/v1/cards/:id/details' do
    it 'marks the card provider_missing and returns a stable not-found code when provider card id is invalid' do
      card = Card.create!(user: user, card_id: 'provider-card-1', status: 'active')
      service = instance_double(BridgeCardService)
      allow(BridgeCardService).to receive(:new).and_return(service)
      allow(service).to receive(:card_details).with('provider-card-1').and_return(
        { status: :unprocessable_entity, message: "Invalid card ID, there's no card with this ID." }
      )

      get "/api/v1/cards/#{card.id}/details", headers: headers

      expect(response).to have_http_status(:not_found)
      body = JSON.parse(response.body)
      expect(body['code']).to eq('CARD_PROVIDER_MISSING')
      expect(card.reload.status).to eq('provider_missing')
      expect(card.meta_data['provider_missing_reason']).to include('Invalid card ID')
    end
  end

  describe 'GET /api/v1/cards/:id/balance' do
    it 'short-circuits without provider call once card is already marked provider_missing' do
      card = Card.create!(user: user, card_id: 'provider-card-2', status: 'provider_missing')
      expect(BridgeCardService).not_to receive(:new)

      get "/api/v1/cards/#{card.id}/balance", headers: headers

      expect(response).to have_http_status(:not_found)
      body = JSON.parse(response.body)
      expect(body['code']).to eq('CARD_PROVIDER_MISSING')
    end
  end
end
