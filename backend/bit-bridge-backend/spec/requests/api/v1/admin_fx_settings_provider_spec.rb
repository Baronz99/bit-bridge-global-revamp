# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin FX settings provider', type: :request do
  let(:admin) { create(:user, role: 'super_admin') }
  let(:headers) { auth_headers(admin) }

  before do
    FxSetting.current.update!(provider_fx_divisor: 100)
  end

  it 'includes provider fields in show response' do
    get '/api/v1/admin/fx-settings', headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body.dig('data', 'bridgecard_provider')).to be_present
  end

  it 'refreshes provider FX rate' do
    allow(Bridgecard::FxRateFetcher).to receive(:call).and_return(
      raw: 74_100,
      divisor: 100,
      computed_rate: 741.0,
      as_of: Time.current.iso8601,
      source: 'bridgecard',
      pair: 'NGN-USD'
    )

    post '/api/v1/admin/fx-settings/refresh-provider', headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['message']).to be_present
    expect(body.dig('data', 'provider')).to be_present
    expect(body.dig('data', 'provider', 'computed_rate')).to eq(741.0)
  end

  it 'returns 429 if refresh is called too soon' do
    setting = FxSetting.current
    setting.update!(provider_updated_at: Time.current, provider_raw: 74100, provider_usd_ngn_rate: 741.0)

    post '/api/v1/admin/fx-settings/refresh-provider', headers: headers

    expect(response).to have_http_status(:too_many_requests)
    body = JSON.parse(response.body)
    expect(body['message']).to match(/once per minute/i)
    expect(body['retry_after_seconds']).to be_present
    expect(body.dig('data', 'provider')).to be_present
    expect(body.dig('data', 'provider', 'computed_rate')).to eq(741.0)
  end

  it 'applies provider FX rate to base rate' do
    setting = FxSetting.current
    setting.update!(provider_usd_ngn_rate: 741.0)

    post '/api/v1/admin/fx-settings/apply-provider', headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['message']).to be_present
    expect(body.dig('data', 'base_usd_ngn_rate')).to eq(741.0)
  end

  it 'parses string raw values from provider feed' do
    allow(Bridgecard::FxRateFetcher).to receive(:call).and_return(
      raw: 74_100,
      divisor: 100,
      computed_rate: 741.0,
      as_of: Time.current.iso8601,
      source: 'bridgecard',
      pair: 'NGN-USD'
    )

    post '/api/v1/admin/fx-settings/refresh-provider', headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body.dig('data', 'provider', 'raw')).to eq(74_100)
  end

  it 'returns a consistent error response when provider fails' do
    allow(Bridgecard::FxRateFetcher).to receive(:call).and_raise(
      Bridgecard::FxRateFetcher::Error, 'Bridgecard rate limited'
    )

    post '/api/v1/admin/fx-settings/refresh-provider', headers: headers

    expect(response).to have_http_status(:bad_gateway)
    body = JSON.parse(response.body)
    expect(body['message']).to eq('Bridgecard rate limited')
    expect(body.dig('data', 'provider')).to be_present
  end
end
