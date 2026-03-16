# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Notification service status subscriptions', type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers(user) }

  it 'creates and fetches a service status subscription' do
    post '/api/v1/notifications/service_status_subscriptions',
         params: {
           provider: 'buypower',
           service_key: 'ABUJA_ELECTRICITY'
         },
         headers: headers

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body).dig('data', 'subscribed')).to eq(true)

    get '/api/v1/notifications/service_status_subscriptions',
        params: {
          provider: 'buypower',
          service_key: 'ABUJA_ELECTRICITY'
        },
        headers: headers

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body).dig('data', 'subscribed')).to eq(true)
  end

  it 'disables an existing subscription' do
    ServiceStatusSubscription.create!(
      user: user,
      provider: 'buypower',
      service_key: 'IKEJA_ELECTRICITY',
      channel: 'push',
      active: true,
      expires_at: 3.days.from_now
    )

    delete '/api/v1/notifications/service_status_subscriptions',
           params: {
             provider: 'buypower',
             service_key: 'IKEJA_ELECTRICITY'
           },
           headers: headers

    expect(response).to have_http_status(:ok)
    expect(user.service_status_subscriptions.find_by(service_key: 'IKEJA_ELECTRICITY').active).to eq(false)
  end
end
