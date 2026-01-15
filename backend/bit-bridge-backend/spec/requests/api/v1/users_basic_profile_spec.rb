# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Basic profile BVN snapshot recheck', type: :request do
  let(:user) { create(:user) }
  let(:headers) { auth_headers(user) }

  before do
    user.create_user_profile!(
      first_name: 'Old',
      last_name: 'Name',
      date_of_birth: Date.new(1990, 1, 1)
    )
    user.create_user_kyc!(
      bvn_status: 'mismatch',
      bvn_fingerprint: Kyc::BvnFingerprint.generate('12345678901'),
      bvn_snapshot_first_name: 'Test',
      bvn_snapshot_last_name: 'User',
      bvn_snapshot_dob: '1990-01-01',
      bvn_snapshot_watchlisted: false,
      bvn_snapshot_reference: 'prembly-ref',
      bvn_snapshot_captured_at: 1.hour.ago,
      bvn_snapshot_expires_at: 1.day.from_now
    )
  end

  it 'auto-verifies using snapshot after profile update' do
    params = {
      user: {
        id_type: 'bvn',
        user_profile_attributes: {
          first_name: 'Test',
          last_name: 'User',
          date_of_birth: '1990-01-01',
          phone_number: '08012345678'
        }
      }
    }

    patch '/api/v1/users/basic_profile', params: params, headers: headers

    expect(response).to have_http_status(:ok)
    user.user_kyc.reload
    expect(user.user_kyc.bvn_status).to eq('verified')
    expect(user.user_kyc.bvn_last_result_status).to eq('verified')
  end

  it 'skips snapshot recheck when fingerprint is missing' do
    user.user_kyc.update!(bvn_fingerprint: nil)

    params = {
      user: {
        id_type: 'bvn',
        user_profile_attributes: {
          first_name: 'Test',
          last_name: 'User',
          date_of_birth: '1990-01-01',
          phone_number: '08012345678'
        }
      }
    }

    patch '/api/v1/users/basic_profile', params: params, headers: headers

    expect(response).to have_http_status(:ok)
    user.user_kyc.reload
    expect(user.user_kyc.bvn_status).to eq('mismatch')
  end
end
