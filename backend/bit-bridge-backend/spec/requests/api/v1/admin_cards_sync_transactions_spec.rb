# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin card sync transactions', type: :request do
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

  it 'syncs transactions for a card' do
    allow(Bridgecard::SyncCardTransactions).to receive(:call).and_return(status: :ok, count: 2)

    post "/api/v1/admin/cards/#{card.id}/sync-transactions", headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['data']['card_id']).to eq('card_123')
    expect(body['data']['synced']).to eq(true)
    expect(body['data']['upserted_count']).to eq(2)
    expect(body['data']['synced_count']).to be_a(Integer)
    expect(body['data']['created_count']).to be_a(Integer)
    expect(body['data']['updated_count']).to be_a(Integer)
  end

  it 'returns 404 when admin card debug is disabled' do
    ENV['ENABLE_ADMIN_CARD_DEBUG'] = 'false'

    post "/api/v1/admin/cards/#{card.id}/sync-transactions", headers: headers

    expect(response).to have_http_status(:not_found)
  end
end
