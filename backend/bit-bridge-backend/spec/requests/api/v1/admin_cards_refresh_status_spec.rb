# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin card refresh status', type: :request do
  let(:admin) { create(:user, role: 'super_admin') }
  let(:headers) { auth_headers(admin) }
  let!(:card) { Card.create!(user: admin, card_id: 'card_123') }

  around do |example|
    original = ENV.to_h
    ENV['ENABLE_BRIDGE_CARDS'] = 'true'
    ENV['BRIDGE_CARD_TOKEN'] = 'sandbox'
    example.run
    ENV.replace(original)
  end

  it 'refreshes provider status' do
    allow(Bridgecard::CardStatusRefresher).to receive(:call) do |card:|
      card.apply_provider_state!(provider_status: 'active', livemode: false)
      { status: :ok, data: { provider_status: 'active', raw: {} } }
    end

    post "/api/v1/admin/cards/#{card.id}/refresh-provider-status", headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['data']['provider_status']).to eq('active')
    expect(body['data']['provider_livemode']).to eq(false)
  end

  it 'returns safe fields when debug is disabled' do
    ENV['ENABLE_ADMIN_CARD_DEBUG'] = 'false'
    allow(Bridgecard::CardStatusRefresher).to receive(:call) do |card:|
      card.apply_provider_state!(provider_status: 'active', livemode: false)
      { status: :ok, data: { provider_status: 'active', raw: { secret: 'nope' } } }
    end

    post "/api/v1/admin/cards/#{card.id}/refresh-provider-status", headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['data']).not_to have_key('raw')
    expect(body['data']).not_to have_key('debug_context')
  end

  it 'rate limits frequent refreshes' do
    card.update!(provider_updated_at: Time.current)

    post "/api/v1/admin/cards/#{card.id}/refresh-provider-status", headers: headers

    expect(response).to have_http_status(:too_many_requests)
    body = JSON.parse(response.body)
    expect(body['retry_after_seconds']).to be_a(Integer)
  end
end
