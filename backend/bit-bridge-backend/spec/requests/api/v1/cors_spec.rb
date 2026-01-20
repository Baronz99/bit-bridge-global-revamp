# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'CORS preflight', type: :request do
  let(:origin) { 'https://bitbridgeglobal.com' }
  let(:requested_headers) { 'Accept, Authorization, Content-Type, Bit-Refresh-Token' }

  it 'allows preflight for api login from production origin' do
    options '/api/v1/login',
            headers: {
              'Origin' => origin,
              'Access-Control-Request-Method' => 'POST',
              'Access-Control-Request-Headers' => requested_headers
            }

    expect(response.headers['Access-Control-Allow-Origin']).to eq(origin)
    expect(response.headers['Access-Control-Allow-Methods']).to include('POST')
    expect(response.headers['Access-Control-Allow-Headers']).to include('Authorization')
    expect(response.headers['Access-Control-Allow-Headers']).to include('Content-Type')
    expect(response.headers['Access-Control-Allow-Headers']).to include('Accept')
  end

  it 'allows preflight for authenticated api route from production origin' do
    options '/api/v1/users/user_profile',
            headers: {
              'Origin' => origin,
              'Access-Control-Request-Method' => 'GET',
              'Access-Control-Request-Headers' => requested_headers
            }

    expect(response.headers['Access-Control-Allow-Origin']).to eq(origin)
    expect(response.headers['Access-Control-Allow-Methods']).to include('GET')
    expect(response.headers['Access-Control-Allow-Headers']).to include('Authorization')
  end
end
