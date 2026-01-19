# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin FX settings exchange rate provider', type: :request do
  let(:admin) { create(:user, role: 'super_admin') }
  let(:headers) { auth_headers(admin) }

  it 'show includes provider section' do
    get '/api/v1/admin/fx-settings', headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body.dig('data', 'provider')).to be_present
  end

  it 'refresh stores provider fields and returns payload' do
    http_response = instance_double(
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
    allow(HTTParty).to receive(:get).and_return(http_response)

    post '/api/v1/admin/fx-settings/provider/refresh', headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['message']).to be_present
    expect(body.dig('data', 'provider', 'computed_ngn_per_usd')).to eq(1500)
  end

  it 'returns 429 when rate limited' do
    setting = FxSetting.current
    setting.update!(provider_updated_at: Time.current, provider_rates: { 'NGN' => 1500 })

    post '/api/v1/admin/fx-settings/provider/refresh', headers: headers

    expect(response).to have_http_status(:too_many_requests)
    body = JSON.parse(response.body)
    expect(body['retry_after_seconds']).to be_present
    expect(body.dig('data', 'provider', 'computed_ngn_per_usd')).to eq(1500)
  end

  it 'returns 422 when provider is stale' do
    setting = FxSetting.current
    setting.update!(provider_updated_at: 2.days.ago, provider_rates: { 'NGN' => 1500, 'EUR' => 0.9 })

    post '/api/v1/admin/fx-settings/provider/apply',
         params: { apply: { ngn_to_usd_base: true, currencies: ['EUR'] } },
         headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body['message']).to match(/stale/i)
  end

  it 'allows apply when force=true even if stale' do
    setting = FxSetting.current
    setting.update!(provider_updated_at: 2.days.ago, provider_rates: { 'NGN' => 1500, 'EUR' => 0.9 })

    post '/api/v1/admin/fx-settings/provider/apply',
         params: { apply: { ngn_to_usd_base: true, currencies: ['EUR'], force: true } },
         headers: headers

    expect(response).to have_http_status(:ok)
    setting.reload
    expect(setting.base_usd_ngn_rate.to_f).to eq(1500.0)
  end

  it 'returns 422 when a requested currency is out of range' do
    setting = FxSetting.current
    setting.update!(provider_updated_at: Time.current, provider_rates: { 'NGN' => 1500, 'EUR' => 10 })

    post '/api/v1/admin/fx-settings/provider/apply',
         params: { apply: { ngn_to_usd_base: true, currencies: ['EUR'] } },
         headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body['message']).to match(/out of range/i)
  end

  it 'apply returns 422 when provider missing' do
    FxSetting.current.update!(provider_rates: {})

    post '/api/v1/admin/fx-settings/provider/apply',
         params: { apply: { ngn_to_usd_base: true } },
         headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
  end

  it 'apply updates base rate and base_fx_rates' do
    FxSetting.current.update!(provider_updated_at: Time.current, provider_rates: { 'NGN' => 1500, 'EUR' => 0.9 })

    post '/api/v1/admin/fx-settings/provider/apply',
         params: { apply: { ngn_to_usd_base: true, currencies: ['EUR'] } },
         headers: headers

    expect(response).to have_http_status(:ok)
    setting = FxSetting.current
    expect(setting.base_usd_ngn_rate.to_f).to eq(1500.0)
    expect(setting.base_fx_rates['EURUSD']).to eq(1.11111111)
    expect(setting.base_fx_rates['USDNGN']).to eq(1500.0)
  end
end
