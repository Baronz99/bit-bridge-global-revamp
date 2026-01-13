# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Bridgecard::FxRateFetcher do
  let(:setting) { FxSetting.current }

  around do |example|
    original = ENV.to_h
    ENV['BRIDGE_CARD_TOKEN'] = 'test'
    example.run
    ENV.replace(original)
  end

  it 'parses raw string rate values' do
    response = instance_double(
      HTTParty::Response,
      success?: true,
      code: 200,
      body: '{"data":{"NGN-USD":"74100"}}',
      parsed_response: { 'data' => { 'NGN-USD' => '74100' } }
    )
    allow(HTTParty).to receive(:get).and_return(response)

    result = described_class.call(setting: setting)

    expect(result[:raw]).to eq(74_100)
    expect(result[:computed_rate].to_f).to eq(741.0)
  end

  it 'raises authorization error on 401' do
    response = instance_double(
      HTTParty::Response,
      success?: false,
      code: 401,
      body: '{"message":"unauthorized"}',
      parsed_response: { 'message' => 'unauthorized' }
    )
    allow(HTTParty).to receive(:get).and_return(response)

    expect {
      described_class.call(setting: setting)
    }.to raise_error(Bridgecard::FxRateFetcher::Error, /authorization/i)
  end

  it 'raises provider unavailable on 500' do
    response = instance_double(
      HTTParty::Response,
      success?: false,
      code: 500,
      body: 'error',
      parsed_response: 'error'
    )
    allow(HTTParty).to receive(:get).and_return(response)

    expect {
      described_class.call(setting: setting)
    }.to raise_error(Bridgecard::FxRateFetcher::Error, /unavailable/i)
  end

  it 'raises parsing error on invalid JSON' do
    response = instance_double(
      HTTParty::Response,
      success?: true,
      code: 200,
      body: 'invalid',
      parsed_response: nil
    )
    allow(HTTParty).to receive(:get).and_return(response)

    expect {
      described_class.call(setting: setting)
    }.to raise_error(Bridgecard::FxRateFetcher::Error, /parsing/i)
  end

  it 'rejects out-of-range computed rates' do
    response = instance_double(
      HTTParty::Response,
      success?: true,
      code: 200,
      body: '{"data":{"NGN-USD":"999999999"}}',
      parsed_response: { 'data' => { 'NGN-USD' => '999999999' } }
    )
    allow(HTTParty).to receive(:get).and_return(response)

    expect {
      described_class.call(setting: setting)
    }.to raise_error(Bridgecard::FxRateFetcher::Error, /out of range/i)
  end
end
