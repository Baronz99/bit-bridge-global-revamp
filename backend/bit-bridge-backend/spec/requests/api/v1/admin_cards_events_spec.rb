# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin card events', type: :request do
  let(:admin) { create(:user, role: 'super_admin') }
  let(:headers) { auth_headers(admin) }
  let!(:card) { Card.create!(user: admin, card_id: 'card_123') }

  around do |example|
    original = ENV.to_h
    ENV['ENABLE_BRIDGE_CARDS'] = 'true'
    ENV['ENABLE_ADMIN_CARD_DEBUG'] = 'false'
    example.run
    ENV.replace(original)
  end

  it 'returns events without calling provider when debug disabled' do
    CardEvent.create!(
      user: admin,
      card_id: card.card_id,
      event: 'card_debit_event.successful',
      status: 'successful',
      amount: 10,
      currency: 'USD'
    )

    expect(BridgeCardService).not_to receive(:new)

    get "/api/v1/admin/cards/#{card.id}/events", params: { limit: 5 }, headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['data']).to be_an(Array)
  end
end
