# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin card provider transactions', type: :request do
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

  it 'returns provider transactions' do
    service = instance_double(BridgeCardService)
    allow(BridgeCardService).to receive(:new).and_return(service)
    allow(service).to receive(:list_card_transactions).and_return(
      status: :ok,
      data: [{ 'id' => 'tx_1' }]
    )

    get "/api/v1/admin/cards/#{card.id}/provider-transactions", headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['data']).to be_a(Array).or be_a(Hash)
  end
end
