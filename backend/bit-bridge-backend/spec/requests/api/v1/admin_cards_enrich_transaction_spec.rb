# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin card transaction enrichment', type: :request do
  let(:admin) { create(:user, role: 'super_admin') }
  let(:headers) { auth_headers(admin) }
  let!(:card) { Card.create!(user: admin, card_id: 'card_123') }
  let!(:event) do
    CardEvent.create!(
      user: admin,
      card_id: card.card_id,
      event: 'card_debit_event.successful',
      status: 'successful',
      provider_transaction_reference: 'ref_123',
      amount: 12.5,
      currency: 'USD'
    )
  end

  around do |example|
    original = ENV.to_h
    ENV['ENABLE_BRIDGE_CARDS'] = 'true'
    ENV['BRIDGE_CARD_TOKEN'] = 'sandbox'
    ENV['ENABLE_ADMIN_CARD_DEBUG'] = 'true'
    example.run
    ENV.replace(original)
  end

  it 'enriches a card event by reference' do
    allow(Bridgecard::EnrichTransactionDetails).to receive(:call).and_return(
      ok: true,
      data: { enriched: true }
    )

    post "/api/v1/admin/cards/#{card.id}/enrich-transaction", params: { reference: 'ref_123' }, headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body.dig('data', 'reference')).to eq('ref_123')
    expect(body.dig('data', 'enriched')).to eq(true)
  end

  it 'returns 404 when admin card debug is disabled' do
    ENV['ENABLE_ADMIN_CARD_DEBUG'] = 'false'

    post "/api/v1/admin/cards/#{card.id}/enrich-transaction", params: { reference: 'ref_123' }, headers: headers

    expect(response).to have_http_status(:not_found)
  end
end
