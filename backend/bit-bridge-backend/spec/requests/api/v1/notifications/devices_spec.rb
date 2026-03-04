# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Notification Devices', type: :request do
  def auth_header_for(user)
    token, = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil)
    { 'Authorization' => "Bearer #{token}" }
  end

  describe 'POST /api/v1/notifications/devices' do
    it 'registers a device token for the authenticated user' do
      user = create(:user, :confirmed)

      post '/api/v1/notifications/devices',
           params: {
             device: {
               token: 'expo-token-test-123',
               provider: 'expo',
               platform: 'ios',
               app_version: '1.0.0'
             }
           },
           headers: auth_header_for(user)

      expect(response).to have_http_status(:ok)
      expect(user.notification_devices.where(token: 'expo-token-test-123').count).to eq(1)
    end
  end

  describe 'DELETE /api/v1/notifications/devices/:token' do
    it 'deactivates the token for the authenticated user' do
      user = create(:user, :confirmed)
      create(:notification_device, user: user, token: 'expo-token-test-123')

      delete '/api/v1/notifications/devices',
             params: { token: 'expo-token-test-123' },
             headers: auth_header_for(user)

      expect(response).to have_http_status(:ok)
      expect(user.notification_devices.find_by(token: 'expo-token-test-123').active).to eq(false)
    end
  end
end
