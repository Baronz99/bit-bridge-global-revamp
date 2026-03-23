# frozen_string_literal: true

require 'rails_helper'
require 'securerandom'

RSpec.describe 'Auth endpoints', type: :request do
  let(:user) do
    create(
      :user,
      :confirmed,
      email: "confirmed_#{SecureRandom.hex(6)}@example.com",
      password: 'password123',
      password_confirmation: 'password123'
    )
  end

  it 'logs in via api/v1/login' do
    post '/api/v1/login', params: { email: user.email, password: 'password123' }

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['token']).to be_present
    expect(body['access_token']).to be_present
    expect(body['refresh_token']).to be_present
    serialized_email =
      body.dig('user', 'email') ||
      body.dig('user', 'data', 'attributes', 'email') ||
      body.dig('user', 'data', 'email')
    expect(serialized_email).to eq(user.email)
  end

  it 'refreshes access token via api/v1/refresh' do
    refresh_token = user.generate_refresh_token

    post '/api/v1/refresh', headers: { 'Bit-Refresh-Token' => refresh_token }

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['access_token']).to be_present
  end

  it 'keeps multiple refresh sessions independent across logins and rotations' do
    first_login = post('/api/v1/login', params: { email: user.email, password: 'password123' })
    expect(response).to have_http_status(:ok)
    first_refresh = JSON.parse(response.body).fetch('refresh_token')

    second_login = post('/api/v1/login', params: { email: user.email, password: 'password123' })
    expect(response).to have_http_status(:ok)
    second_refresh = JSON.parse(response.body).fetch('refresh_token')

    expect(first_refresh).not_to eq(second_refresh)

    post '/api/v1/refresh', headers: { 'Bit-Refresh-Token' => first_refresh }
    expect(response).to have_http_status(:ok)
    rotated_first = JSON.parse(response.body).fetch('refresh_token')

    post '/api/v1/refresh', headers: { 'Bit-Refresh-Token' => first_refresh }
    expect(response).to have_http_status(:unauthorized)

    post '/api/v1/refresh', headers: { 'Bit-Refresh-Token' => second_refresh }
    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body).fetch('refresh_token')).to be_present

    post '/api/v1/refresh', headers: { 'Bit-Refresh-Token' => rotated_first }
    expect(response).to have_http_status(:ok)
  end

  it 'rejects login for unconfirmed users' do
    unconfirmed_user = build(
      :user,
      email: "unconfirmed_#{SecureRandom.hex(6)}@example.com",
      password: 'password123',
      password_confirmation: 'password123'
    )
    unconfirmed_user.skip_confirmation_notification!
    unconfirmed_user.save!

    post '/api/v1/login', params: { email: unconfirmed_user.email, password: 'password123' }

    expect(response).to have_http_status(:forbidden)
    body = JSON.parse(response.body)
    expect(body['error']).to eq('email_not_confirmed')
    expect(body['message']).to be_present
  end
end
