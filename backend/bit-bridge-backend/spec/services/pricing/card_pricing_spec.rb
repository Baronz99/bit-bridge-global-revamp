# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Pricing::CardPricing do
  it 'applies usd fees with caps' do
    quote = described_class.quote({ 'currency' => 'USD', 'amount' => 2000 })

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
