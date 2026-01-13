# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Fx::Providers::ExchangeRateApiFetcher do
  let(:setting) { FxSetting.current }

  it 'stores provider fields on success' do
    response = instance_double(
      HTTParty::Response,
      success?: true,
      code: 200,
      parsed_response: {
        'result' => 'success',
        'base_code' => 'USD',
        'rates' => { 'NGN' => 1500, 'EUR' => 0.9 },
        'time_last_update_utc' => 'Mon, 01 Jan 2026 00:00:00 +0000'
      }
    )
    allow(HTTParty).to receive(:get).and_return(response)

    result = described_class.call(setting: setting)

    expect(result[:source]).to eq('exchangerate_api')
    expect(setting.reload.provider_rates['NGN']).to eq(1500)
    expect(setting.provider_base).to eq('USD')
  end

  it 'raises on non-success response' do
    response = instance_double(
      HTTParty::Response,
      success?: false,
      code: 500,
      parsed_response: {}
    )
    allow(HTTParty).to receive(:get).and_return(response)

    expect {
      described_class.call(setting: setting)
    }.to raise_error(Fx::Providers::ExchangeRateApiFetcher::Error)
  end
end
