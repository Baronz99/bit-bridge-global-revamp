# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Auth endpoints', type: :request do
  let(:user) { create(:user, password: 'password123', password_confirmation: 'password123') }

  it 'logs in via api/v1/login' do
    post '/api/v1/login', params: { email: user.email, password: 'password123' }

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['token']).to be_present
    expect(body.dig('user', 'email')).to eq(user.email)
  end

  it 'refreshes access token via api/v1/refresh' do
    refresh_token = user.generate_refresh_token

    post '/api/v1/refresh', headers: { 'Bit-Refresh-Token' => refresh_token }

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['access_token']).to be_present
  end
end
