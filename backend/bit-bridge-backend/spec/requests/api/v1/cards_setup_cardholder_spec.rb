# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Cards setup cardholder', type: :request do
  let(:user) { create(:user, :tier2, :confirmed, email: "cards-setup-#{SecureRandom.hex(4)}@example.com") }
  let(:headers) { auth_headers(user).merge('X-Idempotency-Key' => SecureRandom.uuid) }
  let(:cache_store) { ActiveSupport::Cache::MemoryStore.new }

  around do |example|
    original = ENV.to_h
    original_cache = Rails.cache
    ENV['ENABLE_BRIDGE_CARDS'] = 'true'
    Rails.instance_variable_set(:@cache, cache_store)
    Rails.cache.clear
    example.run
    Rails.cache.clear
    Rails.instance_variable_set(:@cache, original_cache)
    ENV.replace(original)
  end

  it 'treats verified-but-nonreusable bvn as missing for cardholder setup' do
    UserProfile.create!(
      user: user,
      first_name: 'Patience',
      last_name: 'Ibezimako',
      phone_number: '08030000000',
      address_line1: '14 Broad Street',
      city: 'Lagos',
      state: 'Lagos'
    )
    UserKyc.create!(
      user: user,
      bvn_status: 'verified',
      bvn_verified_at: Time.current,
      bvn_encrypted: nil
    )

    post '/api/v1/cards/setup_cardholder',
         params: { card: { selfie_image: 'https://example.com/selfie.jpg' } },
         headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['state']).to eq('cardholder_profile_incomplete')
    expect(body['next_action']).to eq('complete_profile')
    expect(body.dig('data', 'missing_fields')).to include('bvn')
  end
end
