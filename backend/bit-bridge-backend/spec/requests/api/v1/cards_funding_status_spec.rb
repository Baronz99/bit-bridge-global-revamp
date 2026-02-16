# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Cards funding status', type: :request do
  let(:user) { create(:user, :tier2, :confirmed) }
  let(:headers) { auth_headers(user) }
  let!(:card) { Card.create!(user: user, card_id: 'provider-card-123', status: 'active') }

  around do |example|
    original = ENV.to_h
    ENV['ENABLE_BRIDGE_CARDS'] = 'true'
    example.run
    ENV.replace(original)
  end

  describe 'GET /api/v1/cards/:id/funding_status' do
    it 'returns successful when local credit event exists even if provider status call fails' do
      reference = 'card-fund-local-success'
      CardEvent.create!(
        event: 'card_credit_event.successful',
        event_name: 'card_credit_event',
        status: 'successful',
        event_status: 'successful',
        card_id: card.card_id,
        card_transaction_type: 'CREDIT',
        provider_transaction_reference: reference
      )

      service = instance_double(BridgeCardService)
      allow(BridgeCardService).to receive(:new).and_return(service)
      allow(service).to receive(:get_card_transaction_status).and_return(
        { status: :unprocessable_entity, message: 'provider timeout' }
      )

      get "/api/v1/cards/#{card.id}/funding_status", params: { reference: reference }, headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.dig('data', 'state')).to eq('successful')
      expect(body.dig('data', 'provider_error')).to eq('provider timeout')
    end

    it 'falls back to pending when reference resolves from latest local funding transaction' do
      wallet = Wallet.create!(user: user, wallet_type: :usd, currency: 'USD', balance_cents: 10_000)
      Transaction.create!(
        wallet: wallet,
        transaction_type: :withdrawal,
        status: :approved,
        amount: 5,
        coin_type: :bank,
        address: 'Virtual Card Funding (USD)',
        unique_transaction_id: 'card-fund-pending-ref',
        bridge_card_id: card.card_id
      )

      service = instance_double(BridgeCardService)
      allow(BridgeCardService).to receive(:new).and_return(service)
      allow(service).to receive(:get_card_transaction_status).and_return(
        { status: :unprocessable_entity, message: 'provider unavailable' }
      )

      get "/api/v1/cards/#{card.id}/funding_status", headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.dig('data', 'transaction_reference')).to eq('card-fund-pending-ref')
      expect(body.dig('data', 'state')).to eq('pending')
    end
  end
end
