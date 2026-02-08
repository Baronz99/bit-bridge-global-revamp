# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FxDesk::Pricing do
  before do
    FxSetting.delete_all
    FxSetting.create!(base_usd_ngn_rate: 1500)
  end

  let(:pricing) { described_class.new }

  it 'deducts the fee before applying the rate' do
    quote = pricing.quote_ngn_to_usd(10_000)
    expected_fee = FxDesk::Money.ngn(10_000.to_d * 0.01)

    expect(quote[:fee_amount]).to eq(expected_fee)
    expect(quote[:amount_after_fee]).to eq(FxDesk::Money.ngn(10_000.to_d - (10_000.to_d * 0.01)))
  end

  it 'applies the execution rate to amount_after_fee' do
    quote = pricing.quote_ngn_to_usd(10_000)
    expected = FxDesk::Money.usd(quote[:amount_after_fee_raw] / quote[:execution_rate_raw])

    expect(quote[:amount_out]).to eq(expected)
  end

  it 'applies tiered markup by USD notional' do
    low_markup = pricing.markup_for_usd_notional(40)
    mid_markup = pricing.markup_for_usd_notional(100)
    high_markup = pricing.markup_for_usd_notional(250)

    expect(low_markup).to eq(75.to_d)
    expect(mid_markup).to eq(60.to_d)
    expect(high_markup).to eq(45.to_d)
  end

  it 'keeps bid and ask symmetric around base rate' do
    notional = 100
    base = pricing.base_rate
    markup = pricing.markup_for_usd_notional(notional)

    expect(pricing.ask_rate(notional) - base).to eq(markup)
    expect(base - pricing.bid_rate(notional)).to eq(markup)
  end

  it 'rounds NGN and USD amounts correctly' do
    ngn_quote = pricing.quote_ngn_to_usd(10_005.4)
    usd_quote = pricing.quote_usd_to_ngn(12.3456)

    expect(ngn_quote[:amount_in]).to eq(FxDesk::Money.ngn(10_005.4))
    expect(ngn_quote[:fee_amount]).to eq(FxDesk::Money.ngn(ngn_quote[:fee_amount_raw]))
    expect(ngn_quote[:amount_after_fee]).to eq(FxDesk::Money.ngn(ngn_quote[:amount_after_fee_raw]))
    expect(ngn_quote[:amount_out]).to eq(FxDesk::Money.usd(ngn_quote[:amount_out_raw]))

    expect(usd_quote[:amount_in]).to eq(FxDesk::Money.usd(12.3456))
    expect(usd_quote[:fee_amount]).to eq(FxDesk::Money.usd(usd_quote[:fee_amount_raw]))
    expect(usd_quote[:amount_after_fee]).to eq(FxDesk::Money.usd(usd_quote[:amount_after_fee_raw]))
    expect(usd_quote[:amount_out]).to eq(FxDesk::Money.ngn(usd_quote[:amount_out_raw]))
  end

  it 'uses fresh Bridgecard provider rate as base when lock is enabled' do
    old_source = ENV['FX_BASE_RATE_SOURCE']
    old_max_age = ENV['FX_PROVIDER_MAX_AGE_SECONDS']
    ENV['FX_BASE_RATE_SOURCE'] = 'bridgecard'
    ENV['FX_PROVIDER_MAX_AGE_SECONDS'] = '300'
    FxSetting.current.update!(
      base_usd_ngn_rate: 1500,
      provider_source: 'bridgecard',
      provider_usd_ngn_rate: 1600,
      provider_updated_at: Time.current
    )

    expect(pricing.base_rate).to eq(1600.to_d)
  ensure
    ENV['FX_BASE_RATE_SOURCE'] = old_source
    ENV['FX_PROVIDER_MAX_AGE_SECONDS'] = old_max_age
  end

  it 'falls back to stored base rate when Bridgecard feed is stale in lock mode' do
    old_source = ENV['FX_BASE_RATE_SOURCE']
    old_max_age = ENV['FX_PROVIDER_MAX_AGE_SECONDS']
    ENV['FX_BASE_RATE_SOURCE'] = 'bridgecard'
    ENV['FX_PROVIDER_MAX_AGE_SECONDS'] = '300'
    FxSetting.current.update!(
      base_usd_ngn_rate: 1500,
      provider_source: 'bridgecard',
      provider_usd_ngn_rate: 1600,
      provider_updated_at: 10.minutes.ago
    )

    expect(pricing.base_rate).to eq(1500.to_d)
  ensure
    ENV['FX_BASE_RATE_SOURCE'] = old_source
    ENV['FX_PROVIDER_MAX_AGE_SECONDS'] = old_max_age
  end
end
