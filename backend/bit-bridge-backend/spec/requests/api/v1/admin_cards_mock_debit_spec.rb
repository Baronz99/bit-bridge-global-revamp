# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin card mock debit', type: :request do
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

  it 'blocks when env is not sandbox' do
    allow(Bridgecard::Config).to receive(:env_name).and_return('live')

    post "/api/v1/admin/cards/#{card.id}/mock_debit", headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
  end

  it 'blocks in production' do
    allow(Rails.env).to receive(:production?).and_return(true)

    post "/api/v1/admin/cards/#{card.id}/mock_debit", headers: headers

    expect(response).to have_http_status(:forbidden)
  end

  it 'triggers mock debit in sandbox dev' do
    allow(Bridgecard::Config).to receive(:env_name).and_return('sandbox')
    allow(Rails.env).to receive(:production?).and_return(false)
    service = instance_double(BridgeCardService)
    allow(BridgeCardService).to receive(:new).and_return(service)
    allow(service).to receive(:mock_debit_transaction).and_return(
      status: :ok,
      data: { transaction_reference: 'ref_123', card_id: card.card_id }
    )
    allow(service).to receive(:fetch_card_transaction_by_id).and_return(
      status: :ok,
      ok: true,
      data: {
        'bridgecard_transaction_reference' => 'ref_123',
        'status' => 'successful',
        'card_transaction_type' => 'debit',
        'amount' => 5.0,
        'currency' => 'USD'
      }
    )
    allow(service).to receive(:get_card_transactions).and_return(
      status: :ok,
      data: [
        {
          'bridgecard_transaction_reference' => 'ref_123',
          'status' => 'successful',
          'card_transaction_type' => 'debit',
          'amount' => 5.0,
          'currency' => 'USD'
        }
      ]
    )

    expect {
      post "/api/v1/admin/cards/#{card.id}/mock_debit", headers: headers
    }.to change(CardEvent, :count).by(1)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['data']['transaction_reference']).to eq('ref_123')
    expect(body['data']['synced_events']).to eq(1)
  end

  it 'returns 404 when admin card debug is disabled' do
    ENV['ENABLE_ADMIN_CARD_DEBUG'] = 'false'

    post "/api/v1/admin/cards/#{card.id}/mock_debit", headers: headers

    expect(response).to have_http_status(:not_found)
  end
end
