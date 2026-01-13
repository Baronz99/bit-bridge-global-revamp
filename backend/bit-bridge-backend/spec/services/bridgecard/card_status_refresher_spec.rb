# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Bridgecard::CardStatusRefresher do
  let(:user) { create(:user) }
  let(:card) { Card.create!(user: user, card_id: 'card_123') }

  it 'updates provider status from card details' do
    service = instance_double(BridgeCardService)
    allow(BridgeCardService).to receive(:new).and_return(service)
    allow(service).to receive(:fetch_card_details).and_return(
      ok: true,
      data: { provider_status: 'active', livemode: false }
    )

    result = described_class.call(card: card)

    expect(result[:status]).to eq(:ok)
    expect(card.reload.provider_status).to eq('active')
    expect(card.reload.provider_livemode).to eq(false)
  end

  it 'maps is_active to internal status' do
    service = instance_double(BridgeCardService)
    allow(BridgeCardService).to receive(:new).and_return(service)
    allow(service).to receive(:fetch_card_details).and_return(
      ok: true,
      data: { is_active: false, raw: { 'is_active' => false } }
    )

    described_class.call(card: card)

    expect(card.reload.status).to eq('frozen')
  end

  it 'calls provider details fetch' do
    service = instance_double(BridgeCardService)
    allow(BridgeCardService).to receive(:new).and_return(service)
    allow(service).to receive(:fetch_card_details).and_return(
      ok: true,
      data: { provider_status: 'active', livemode: false }
    )

    described_class.call(card: card)

    expect(service).to have_received(:fetch_card_details).with(card_id: card.card_id)
  end
end
