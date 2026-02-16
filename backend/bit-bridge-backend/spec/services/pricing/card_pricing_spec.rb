# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Pricing::CardPricing do
  it 'treats integer USD amount payload as cents' do
    quote = described_class.quote({ 'currency' => 'USD', 'amount' => 1900 })

    expect(quote[:principal_usd].to_f).to eq(19.0)
    expect(quote[:provider_fee_usd].to_f).to eq(0.19)
    expect(quote[:bitbridge_fee_usd].to_f).to eq(0.19)
    expect(quote[:total_debit_usd].to_f).to eq(19.38)
  end

  it 'prefers provider observed fee when partner_interchange_fee is present' do
    quote =
      described_class.quote({
        'currency' => 'USD',
        'amount' => '1900',
        'partner_interchange_fee' => '100'
      })

    expect(quote[:pricing_mode]).to eq('provider_observed')
    expect(quote[:principal_usd].to_f).to eq(19.0)
    expect(quote[:provider_fee_usd].to_f).to eq(1.0)
    expect(quote[:bitbridge_fee_usd].to_f).to eq(0.0)
    expect(quote[:total_debit_usd].to_f).to eq(20.0)
  end

  it 'keeps decimal USD payload values as dollars' do
    quote = described_class.quote({ 'currency' => 'USD', 'amount' => '2000.00' })

    expect(quote[:principal_usd].to_f).to eq(2000.0)
    expect(quote[:provider_fee_usd].to_f).to eq(10.0)
    expect(quote[:bitbridge_fee_usd].to_f).to eq(5.0)
    expect(quote[:fx_markup_usd].to_f).to eq(0.0)
  end

  it 'applies non-usd fees without cap and fx markup' do
    quote = described_class.quote({ 'currency' => 'NGN', 'amount' => 100 })

    expect(quote[:is_non_usd]).to eq(true)
    expect(quote[:provider_fee_usd].to_f).to eq(1.5)
    expect(quote[:bitbridge_fee_usd].to_f).to eq(0.0)
    expect(quote[:fx_markup_usd].to_f).to eq(1.2)
  end

  it 'rounds to two decimals' do
    quote = described_class.quote({ 'currency' => 'USD', 'amount' => 10.115 })

    expect(quote[:principal_usd].to_f).to eq(10.12)
    expect(quote[:provider_fee_usd].to_f).to eq(0.1)
  end
end
