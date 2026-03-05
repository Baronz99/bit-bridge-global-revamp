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

  it 'maps flat enriched_data merchant fields into metadata' do
    data = {
      'bridgecard_transaction_reference' => 'ref_enriched_flat',
      'card_transaction_type' => 'DEBIT',
      'status' => 'successful',
      'amount' => '19.00',
      'currency' => 'USD',
      'enriched_data' => {
        'merchant_name' => 'Facebook',
        'merchant_logo' => 'https://logos.ntropy.com/facebook.com',
        'merchant_website' => 'facebook.com',
        'merchant_city' => 'US',
        'merchant_code' => '123478',
        'transaction_category' => 'Advertisement',
        'transaction_group' => 'Other Outgoing Transactions',
        'is_recurring' => true
      }
    }

    event = described_class.upsert_bridgecard_event!(
      event_name: 'card_debit_event.successful',
      data: data,
      raw_payload: data,
      card: card,
      user_id: user.id
    )

    merchant = event.metadata['merchant']
    expect(merchant['name']).to eq('Facebook')
    expect(merchant['logo']).to eq('https://logos.ntropy.com/facebook.com')
    expect(merchant['website']).to eq('facebook.com')
    expect(merchant['category']).to eq('Advertisement')
    expect(merchant['group']).to eq('Other Outgoing Transactions')
    expect(merchant['recurring']).to eq(true)
  end

  it 'parses transaction_timestamp in milliseconds' do
    data = {
      'transaction_timestamp' => '1741178400000'
    }

    parsed = described_class.parse_transaction_time(data)

    expect(parsed).to eq(Time.zone.at(1_741_178_400))
  end

  it 'parses timezone-less provider datetime using configured provider timezone' do
    original_tz = ENV['BRIDGECARD_TRANSACTION_TIMEZONE']
    ENV['BRIDGECARD_TRANSACTION_TIMEZONE'] = 'Africa/Lagos'

    parsed = nil
    Time.use_zone('UTC') do
      parsed = described_class.parse_transaction_time('transaction_date' => '2026-03-05 10:00:00')
    end

    expect(parsed&.utc&.iso8601).to eq('2026-03-05T09:00:00Z')
  ensure
    ENV['BRIDGECARD_TRANSACTION_TIMEZONE'] = original_tz
  end
end
