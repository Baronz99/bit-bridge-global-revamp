# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin card provider details', type: :request do
  let(:admin) { create(:user, role: 'super_admin') }
  let(:headers) { auth_headers(admin) }
  let!(:card) { Card.create!(user: admin, card_id: 'card_123') }

  around do |example|
    original = ENV.to_h
    ENV['ENABLE_BRIDGE_CARDS'] = 'true'
    ENV['BRIDGE_CARD_TOKEN'] = 'sandbox'
    ENV['ENABLE_ADMIN_CARD_DEBUG'] = 'true'
    example.run
    ENV.replace(original)
  end

  it 'returns provider details' do
    service = instance_double(BridgeCardService)
    allow(BridgeCardService).to receive(:new).and_return(service)
    expect(service).to receive(:fetch_card_details).with(card_id: card.card_id).and_return(
      ok: true,
      data: {
        provider_status: 'active',
        provider_card_id: 'card_123',
        currency: 'USD',
        raw: { 'status' => 'active' }
      }
    )

    get "/api/v1/admin/cards/#{card.id}/provider-details", headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['data']['provider_status']).to eq('active')
    expect(body['data']['raw']).to be_a(Hash)
    expect(body['data']['debug_context']['env_name']).to be_present
    expect(body['data']['debug_context']['token_source']).to be_present
    expect(body['data'].to_s).not_to include('Bearer')
  end

  it 'returns sanitized error payload on provider failure' do
    service = instance_double(BridgeCardService)
    allow(BridgeCardService).to receive(:new).and_return(service)
    allow(service).to receive(:fetch_card_details).and_return(
      ok: false,
      message: 'Bridgecard details fetch failed',
      error: { status: 401, snippet: 'Unauthorized' }
    )

    get "/api/v1/admin/cards/#{card.id}/provider-details", headers: headers

    expect(response).to have_http_status(:bad_gateway)
    body = JSON.parse(response.body)
    expect(body['data']['status_code']).to eq(401)
    expect(body['data']['error_snippet']).to be_present
  end

  it 'returns sanitized error payload for not found' do
    service = instance_double(BridgeCardService)
    allow(BridgeCardService).to receive(:new).and_return(service)
    allow(service).to receive(:fetch_card_details).and_return(
      ok: false,
      message: 'Bridgecard details fetch failed',
      error: { status: 404, snippet: 'Not found' }
    )

    get "/api/v1/admin/cards/#{card.id}/provider-details", headers: headers

    expect(response).to have_http_status(:bad_gateway)
    body = JSON.parse(response.body)
    expect(body['data']['status_code']).to eq(404)
  end

  it 'returns sanitized error payload for unprocessable entity' do
    service = instance_double(BridgeCardService)
    allow(BridgeCardService).to receive(:new).and_return(service)
    allow(service).to receive(:fetch_card_details).and_return(
      ok: false,
      message: 'Bridgecard details fetch failed',
      error: { status: 422, snippet: 'Invalid card' }
    )

    get "/api/v1/admin/cards/#{card.id}/provider-details", headers: headers

    expect(response).to have_http_status(:bad_gateway)
    body = JSON.parse(response.body)
    expect(body['data']['status_code']).to eq(422)
  end

  it 'returns 404 when card debug is disabled' do
    ENV['ENABLE_ADMIN_CARD_DEBUG'] = 'false'

    get "/api/v1/admin/cards/#{card.id}/provider-details", headers: headers

    expect(response).to have_http_status(:not_found)
  end
end
