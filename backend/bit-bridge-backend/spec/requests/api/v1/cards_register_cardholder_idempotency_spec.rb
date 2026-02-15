# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Cards register_cardholder idempotency', type: :request do
  let(:user) { create(:user, :tier2, :confirmed) }
  let(:headers) { auth_headers(user) }

  around do |example|
    original = ENV.to_h
    ENV['ENABLE_BRIDGE_CARDS'] = 'true'
    example.run
    ENV.replace(original)
  end

  it 'returns existing cardholder profile without calling provider registration again' do
    existing_card = Card.create!(
      user: user,
      cardholder_id: 'existing-cardholder-1',
      status: 'provider_missing',
      meta_data: { 'cardholder_kyc_status' => 'verified' }
    )

    expect(BridgeCardService).not_to receive(:new)

    post '/api/v1/cards/register_cardholder', params: { card: {} }, headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body.dig('data', 'id')).to eq(existing_card.id)
    expect(body.dig('data', 'cardholder_id')).to eq('existing-cardholder-1')
    expect(body['message']).to match(/Cardholder profile already exists/i)
  end
end
