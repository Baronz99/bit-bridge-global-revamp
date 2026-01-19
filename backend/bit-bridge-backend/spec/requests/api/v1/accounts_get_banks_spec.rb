# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Accounts get banks', type: :request do
  let(:user) { create(:user) }
  let(:headers) { auth_headers(user) }

  around do |example|
    original = ENV.to_h
    ENV['ANCHOR_BASE_URL'] = nil
    ENV['ANCHOR_API_KEY'] = nil
    ENV['DEV_ANCHOR_BASE_URL'] = nil
    ENV['DEV_ANCHOR_API_KEY'] = nil
    example.run
    ENV.replace(original)
  end

  it 'returns empty list with warning when Anchor env is missing' do
    get '/api/v1/accounts/get_banks', headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['data']).to eq([])
    expect(body['warning']).to match(/Missing ANCHOR_/)
  end
end
