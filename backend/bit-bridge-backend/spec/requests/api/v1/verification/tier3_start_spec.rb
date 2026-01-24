# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Tier3 start', type: :request do
  let(:user) { create(:user) }
  let(:headers) { auth_headers(user) }

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

  before do
    user.create_user_profile!(
      first_name: 'Test',
      last_name: 'User',
      date_of_birth: Date.new(1990, 1, 1)
    )
    user.create_user_kyc!(
      bvn_status: 'verified',
      bvn_verified_at: Time.current,
      bvn_encrypted: nil
    )
  end

  it 'rejects when verified BVN evidence is missing' do
    post '/api/v1/verification/tier3/start',
         params: { image: 'data:image/jpeg;base64,ZmFrZQ==' },
         headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
    json = JSON.parse(response.body)
    expect(json['error']).to match(/Verified BVN not available/i)
  end

  it 'allows Tier3 start when decrypted BVN is present' do
    user.user_kyc.update!(bvn_encrypted: '12345678901')

    post '/api/v1/verification/tier3/start',
         params: { image: 'data:image/jpeg;base64,ZmFrZQ==' },
         headers: headers

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json['status']).to eq('pending')
  end
end
