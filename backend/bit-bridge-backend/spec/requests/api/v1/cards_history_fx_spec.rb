# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Cards history FX', type: :request do
  let(:user) { create(:user, :tier2, :confirmed) }
  let(:headers) { auth_headers(user) }
  let!(:card) { Card.create!(user: user, card_id: 'card_123') }

  around do |example|
    original = ENV.to_h
    ENV['ENABLE_BRIDGE_CARDS'] = 'true'
    example.run
    ENV.replace(original)
  end

  it 'includes fx block when merchant currency is present' do
    CardEvent.create!(
      user: user,
      card_id: card.card_id,
      event: 'card_debit_event.successful',
      status: 'successful',
      amount: 12.5,
      currency: 'USD',
      merchant_currency: 'EUR',
      merchant_amount: 10,
      fx_implied_rate: 1.25
    )

    get "/api/v1/cards/#{card.id}/history", headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    event = body.find { |row| row['source'] == 'bridge' }
    expect(event['fx']).to be_present
    expect(event['fx']['merchant_currency']).to eq('EUR')
  end

  it 'omits fx block when no fx fields are present' do
    CardEvent.create!(
      user: user,
      card_id: card.card_id,
      event: 'card_debit_event.successful',
      status: 'successful',
      amount: 12.5,
      currency: 'USD'
    )

    get "/api/v1/cards/#{card.id}/history", headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    event = body.find { |row| row['source'] == 'bridge' }
    expect(event.key?('fx')).to eq(false)
  end

  it 'includes merchant enrichment block when metadata is present' do
    CardEvent.create!(
      user: user,
      card_id: card.card_id,
      event: 'card_debit_event.successful',
      event_name: 'card_debit_event',
      status: 'successful',
      amount: 19,
      currency: 'USD',
      metadata: {
        merchant: {
          name: 'Facebook',
          logo: 'https://logos.ntropy.com/facebook.com',
          category: 'Advertisement'
        }
      }
    )

    get "/api/v1/cards/#{card.id}/history", headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    event = body.find { |row| row['source'] == 'bridge' }
    expect(event['merchant']).to be_present
    expect(event.dig('merchant', 'name')).to eq('Facebook')
    expect(event.dig('merchant', 'category')).to eq('Advertisement')
  end
end
