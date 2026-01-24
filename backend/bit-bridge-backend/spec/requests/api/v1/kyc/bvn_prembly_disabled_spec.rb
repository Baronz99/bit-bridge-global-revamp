# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'BVN verification when Prembly disabled', type: :request do
  let(:user) { create(:user) }
  let(:headers) { auth_headers(user) }

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

  it 'returns 503 with a clean error payload' do
    user.create_user_profile!(
      first_name: 'Test',
      last_name: 'User',
      date_of_birth: Date.new(1990, 1, 1)
    )
    user.create_user_kyc!

    post '/api/v1/kyc/bvn/verify', params: { bvn: '12345678901' }, headers: headers

    expect(response).to have_http_status(:service_unavailable)
    json = JSON.parse(response.body)
    expect(json['error']).to match(/disabled/i)
  end
end
