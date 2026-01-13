# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Bridgecard::Config do
  around do |example|
    original = ENV.to_h
    example.run
    ENV.replace(original)
  end

  it 'exposes debug context without token value' do
    ENV['BRIDGE_CARD_TOKEN'] = 'sandbox-token'
    allow(Rails.env).to receive(:production?).and_return(false)

    ctx = described_class.debug_context

    expect(ctx[:env_name]).to eq('sandbox')
    expect(ctx[:token_source]).to eq('BRIDGE_CARD_TOKEN')
    expect(ctx[:livemode_expected]).to eq(false)
  end

  it 'selects live env in production' do
    ENV['BRIDGECARD_LIVE_TOKEN'] = 'live-token'
    allow(Rails.env).to receive(:production?).and_return(true)

    expect(described_class.env_name).to eq('live')
    expect(described_class.token_source).to eq('BRIDGECARD_LIVE_TOKEN')
  end
end
