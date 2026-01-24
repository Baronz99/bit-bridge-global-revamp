# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Tier3 Prembly hardening', type: :request do
  let(:user) { create(:user) }
  let(:headers) { auth_headers(user) }

  def setup_verified_kyc!(bvn: '12345678901')
    user.create_user_profile!(
      first_name: 'Test',
      last_name: 'User',
      date_of_birth: Date.new(1990, 1, 1)
    )
    kyc = user.create_user_kyc!(
      bvn_status: 'verified',
      bvn_verified_at: Time.current,
      bvn_encrypted: bvn
    )
    expect(kyc.decrypted_bvn).to eq(bvn)
  end

  describe 'when Prembly is disabled' do
    around do |example|
      old = ENV['ENABLE_PREMBLY']
      ENV['ENABLE_PREMBLY'] = 'false'
      example.run
    ensure
      if old.nil?
        ENV.delete('ENABLE_PREMBLY')
      else
        ENV['ENABLE_PREMBLY'] = old
      end
    end

    it 'returns 503 for tier3 start' do
      setup_verified_kyc!
      post '/api/v1/verification/tier3/start',
           params: { image: 'data:image/jpeg;base64,ZmFrZQ==' },
           headers: headers

      expect(response).to have_http_status(:service_unavailable)
      json = JSON.parse(response.body)
      expect(json['error']).to match(/PREMBLY is disabled/i)
      expect(json['requirements']).to be_present
    end

    it 'returns 503 for tier3 liveness' do
      setup_verified_kyc!
      post '/api/v1/verification/tier3/liveness',
           params: { image: 'data:image/jpeg;base64,ZmFrZQ==' },
           headers: headers

      expect(response).to have_http_status(:service_unavailable)
      json = JSON.parse(response.body)
      expect(json['error']).to match(/PREMBLY is disabled/i)
      expect(json['requirements']).to be_present
    end
  end

  describe 'when Prembly is enabled' do
    around do |example|
      old = ENV['ENABLE_PREMBLY']
      ENV['ENABLE_PREMBLY'] = 'true'
      example.run
    ensure
      if old.nil?
        ENV.delete('ENABLE_PREMBLY')
      else
        ENV['ENABLE_PREMBLY'] = old
      end
    end

    it 'enqueues Tier3 job once' do
      setup_verified_kyc!
      expect(Tier3VerificationJob).to receive(:perform_later).once

      post '/api/v1/verification/tier3/start',
           params: { image: 'data:image/jpeg;base64,ZmFrZQ==' },
           headers: headers
      expect(response).to have_http_status(:ok)
      expect(user.user_kyc.reload.tier3_status).to eq('pending')

      post '/api/v1/verification/tier3/start',
           params: { image: 'data:image/jpeg;base64,ZmFrZQ==' },
           headers: headers
      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json['message'].to_s).to match(/already/i).or(eq(''))
      expect(json['status']).to eq('pending').or(eq('processing')).or(eq('verified'))
    end

    it 'rejects remote URLs for liveness' do
      setup_verified_kyc!
      post '/api/v1/verification/tier3/liveness',
           params: { image: 'https://example.com/x.jpg' },
           headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json['error']).to match(/base64 string or data URL/i)
    end

    it 'rejects remote URLs for start' do
      setup_verified_kyc!
      post '/api/v1/verification/tier3/start',
           params: { image_url: 'https://example.com/x.jpg' },
           headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json['error']).to match(/base64 string or data URL/i)
    end

    it 'returns 413 when liveness payload is too large' do
      setup_verified_kyc!
      big_payload = 'a' * 2_000_001
      post '/api/v1/verification/tier3/liveness',
           params: { image: big_payload },
           headers: headers

      expect(response).to have_http_status(:payload_too_large)
      json = JSON.parse(response.body)
      expect(json['error']).to match(/payload too large/i)
    end

    it 'returns 413 when start payload is too large' do
      setup_verified_kyc!
      big_payload = 'a' * 2_000_001
      post '/api/v1/verification/tier3/start',
           params: { image: big_payload },
           headers: headers

      expect(response).to have_http_status(:payload_too_large)
      json = JSON.parse(response.body)
      expect(json['error']).to match(/payload too large/i)
    end
  end
end
