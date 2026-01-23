# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Wallets user endpoint', type: :request do
  include AuthHelpers

  let(:user) { create(:user) }

  it 'returns JSON with no-store headers and never 304' do
    get '/api/v1/wallets/user', headers: auth_headers(user)

    expect(response).to have_http_status(:ok)
    expect(response.content_type).to include('application/json')
    expect(response.body).to be_present
    expect(response.headers['Cache-Control']).to include('no-store')
    expect(response.headers['ETag']).to be_nil
    JSON.parse(response.body)

    etag = response.headers['ETag']
    last_modified = response.headers['Last-Modified']
    conditional_headers =
      auth_headers(user).merge(
        'If-None-Match' => etag || '"test-etag"',
        'If-Modified-Since' => last_modified || 1.day.ago.httpdate
      )

    get '/api/v1/wallets/user', headers: conditional_headers

    expect(response).to have_http_status(:ok)
    expect(response.request.headers['If-None-Match']).to eq(conditional_headers['If-None-Match'])
    expect(response.request.headers['If-Modified-Since']).to eq(conditional_headers['If-Modified-Since'])
    expect(response.headers['Cache-Control']).to include('no-store')
    expect(response.headers['ETag']).to be_nil
    expect(response.body).to be_present
    JSON.parse(response.body)
  end
end
