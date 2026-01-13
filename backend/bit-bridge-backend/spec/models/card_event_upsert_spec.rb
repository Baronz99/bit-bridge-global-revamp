# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CardEvent, type: :model do
  let(:user) { create(:user) }
  let(:card) { Card.create!(user: user, card_id: 'card_123') }

  it 'upserts by provider reference and event name' do
    data = {
      'bridgecard_transaction_reference' => 'ref_1',
      'card_transaction_type' => 'DEBIT',
      'status' => 'successful',
      'amount' => '10.00',
      'currency' => 'USD'
    }

    event = described_class.upsert_bridgecard_event!(
      event_name: 'card_debit_event.successful',
      data: data,
      raw_payload: data,
      card: card,
      user_id: user.id
    )

    expect(event.event_name).to eq('card_debit_event')

    updated = described_class.upsert_bridgecard_event!(
      event_name: 'card_debit_event.failed',
      data: data.merge('status' => 'failed'),
      raw_payload: data,
      card: card,
      user_id: user.id
    )

    expect(described_class.count).to eq(1)
    expect(updated.status).to eq('failed')
  end

  it 'extracts foreign currency fields when present' do
    FxSetting.current.update!(provider_rates: { 'EUR' => 0.8 })

    data = {
      'bridgecard_transaction_reference' => 'ref_fx',
      'card_transaction_type' => 'DEBIT',
      'status' => 'successful',
      'amount' => '12.50',
      'currency' => 'USD',
      'merchant_currency' => 'EUR',
      'merchant_amount' => '10'
    }

    event = described_class.upsert_bridgecard_event!(
      event_name: 'card_debit_event.successful',
      data: data,
      raw_payload: data,
      card: card,
      user_id: user.id
    )

    expect(event.merchant_currency).to eq('EUR')
    expect(event.merchant_amount.to_s('F')).to eq('10.0')
    expect(event.fx_implied_rate.to_s('F')).to eq('1.25')
    expect(event.fx_reference_rate.to_s('F')).to eq('1.25')
    expect(event.fx_margin_usd.to_s('F')).to eq('0.0')
    expect(event.metadata['fx_discovery_present']).to eq(true)
  end
end
