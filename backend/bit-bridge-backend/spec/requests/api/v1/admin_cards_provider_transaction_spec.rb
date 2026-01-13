# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin card provider transaction lookup', type: :request do
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

  it 'returns provider transaction by reference' do
    service = instance_double(BridgeCardService)
    allow(BridgeCardService).to receive(:new).and_return(service)
    allow(service).to receive(:get_card_transaction_by_id).and_return(
      status: :ok,
      data: {
        'id' => 'tx_1',
        'currency' => 'USD',
        'amount' => '12.50',
        'merchant_currency' => 'EUR',
        'merchant_amount' => '10'
      }
    )

    get "/api/v1/admin/cards/#{card.id}/provider-transaction", params: { reference: 'ref_1' }, headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body.dig('data', 'extracted_fx', 'merchant_currency')).to eq('EUR')
  end

  it 'returns provider transaction status' do
    service = instance_double(BridgeCardService)
    allow(BridgeCardService).to receive(:new).and_return(service)
    allow(service).to receive(:get_card_transaction_status).and_return(
      status: :ok,
      data: { 'status' => 'successful' }
    )

    get "/api/v1/admin/cards/#{card.id}/provider-transaction-status", params: { reference: 'ref_1' }, headers: headers

    expect(response).to have_http_status(:ok)
  end
end
