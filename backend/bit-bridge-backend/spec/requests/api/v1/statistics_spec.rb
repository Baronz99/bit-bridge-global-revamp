# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Statistics', type: :request do
  def auth_header_for(user)
    token, = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil)
    { 'Authorization' => "Bearer #{token}" }
  end

  it 'returns forbidden for non-admin users' do
    user = create(:user, :confirmed)

    get '/api/v1/admin/statistics', headers: auth_header_for(user)

    expect(response).to have_http_status(:forbidden)
    body = JSON.parse(response.body)
    expect(body['message']).to eq('Not authorized')
  end

  it 'returns aggregate stats for admin users' do
    admin = create(:user, :confirmed, role: 'admin')

    get '/api/v1/admin/statistics', headers: auth_header_for(admin)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['data']).to include('users', 'total_deposits', 'total_withdrawals')
  end

  it 'does not expose legacy non-admin stats path' do
    admin = create(:user, :confirmed, role: 'admin')

    get '/api/v1/statistics', headers: auth_header_for(admin)

    expect(response).to have_http_status(:not_found)
  end
end
