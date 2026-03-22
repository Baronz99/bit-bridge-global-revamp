# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin KYC reviews', type: :request do
  let(:admin) { create(:user, email: 'compliance-admin@example.com', role: 'admin', admin_role: 'compliance') }
  let(:headers) { auth_headers(admin) }
  let(:user) { create(:user, email: 'review-target@example.com') }

  before do
    user.create_user_profile!(
      first_name: 'Test',
      last_name: 'User',
      date_of_birth: Date.new(1990, 1, 1)
    )
    user.create_user_kyc!(
      bvn_status: 'mismatch',
      bvn_last4: '7890',
      bvn_last_result_status: 'mismatch',
      bvn_last_result_reason: 'mismatch',
      bvn_snapshot_first_name: 'Test',
      bvn_snapshot_last_name: 'User',
      bvn_snapshot_dob: '1990-01-01',
      bvn_snapshot_expires_at: 1.day.from_now
    )
    KycReview.create!(
      user_id: user.id,
      kyc_type: 'bvn',
      status: 'pending',
      reason: 'mismatch'
    )
  end

  it 'includes snapshot fields in admin review response' do
    get '/api/v1/admin/kyc_reviews', headers: headers

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    data = json['data']
    expect(data).to be_an(Array)

    item = data.first
    expect(item['bvn_snapshot_first_name']).to eq('Test')
    expect(item['bvn_snapshot_last_name']).to eq('User')
    expect(item['bvn_snapshot_dob']).to eq('1990-01-01')
    expect(item['bvn_last4']).to eq('7890')
    expect(item['bvn_last_result_status']).to eq('mismatch')
  end

  it 'includes mismatches without snapshots when include_mismatch is true' do
    other_user = create(:user, email: 'other-mismatch@example.com')
    other_user.create_user_profile!(
      first_name: 'No',
      last_name: 'Snapshot',
      date_of_birth: Date.new(1992, 2, 2)
    )
    other_user.create_user_kyc!(
      bvn_status: 'mismatch',
      bvn_last4: '1111',
      bvn_last_result_status: 'mismatch',
      bvn_last_result_reason: 'provider_unavailable',
      bvn_last_checked_at: 2.days.ago,
      bvn_snapshot_first_name: nil,
      bvn_snapshot_last_name: nil,
      bvn_snapshot_dob: nil,
      bvn_snapshot_expires_at: nil
    )
    pending_user = create(:user, email: 'pending-review@example.com')
    pending_user.create_user_profile!(
      first_name: 'Pending',
      last_name: 'User',
      date_of_birth: Date.new(1995, 5, 5)
    )
    pending_user.create_user_kyc!(
      bvn_status: 'pending',
      bvn_last4: '2222',
      bvn_last_result_status: 'failed',
      bvn_last_result_reason: 'provider_unavailable',
      bvn_last_checked_at: 1.hour.ago,
      bvn_retry_attempt: 2,
      bvn_retry_next_at: Time.current + 120
    )
    KycBvnRetryEvent.create!(
      user_id: pending_user.id,
      user_kyc_id: pending_user.user_kyc.id,
      attempt_number: 2,
      status: 'retry_scheduled',
      reason: 'provider_unavailable',
      next_wait_seconds: 120,
      provider_reference: 'prembly-ref',
      created_at: Time.current
    )

    get '/api/v1/admin/kyc_reviews', params: { include_mismatch: true }, headers: headers

    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    data = json['data']
    expect(data).to be_an(Array)
    mismatch_item = data.find { |item| item['bvn_last4'] == '1111' }
    expect(mismatch_item).to be_present
    expect(mismatch_item['kyc_type']).to eq('bvn')
    expect(mismatch_item['status']).to eq('mismatch')
    expect(data.index { |item| item['bvn_last4'] == '7890' })
      .to be < data.index { |item| item['bvn_last4'] == '1111' }

    pending_item = data.find { |item| item['bvn_last4'] == '2222' }
    expect(pending_item).to be_present
    expect(pending_item['status']).to eq('pending')
    expect(pending_item['bvn_retry_attempt']).to eq(2)
    expect(pending_item['bvn_retry_next_at']).to be_present
    expect(pending_item['retry_events']).to be_an(Array)
    expect(pending_item['retry_events'].first['status']).to eq('retry_scheduled')
  end

  it 'requires reusable BVN before approving a review' do
    review = KycReview.order(created_at: :desc).first

    patch "/api/v1/admin/kyc_reviews/#{review.id}",
          params: { action_type: 'approve' },
          headers: headers

    expect(response).to have_http_status(:unprocessable_entity)
    expect(JSON.parse(response.body)['message']).to eq('Reusable BVN is required before approving BVN verification.')

    expect(user.user_kyc.reload.bvn_status).to eq('mismatch')
    expect(review.reload.status).to eq('pending')
  end

  it 'stores BVN for reusable verification when approving with a valid BVN' do
    review = KycReview.order(created_at: :desc).first

    patch "/api/v1/admin/kyc_reviews/#{review.id}",
          params: { action_type: 'approve', bvn: '12345678901' },
          headers: headers

    expect(response).to have_http_status(:ok)

    kyc = user.user_kyc.reload
    expect(kyc.bvn_status).to eq('verified')
    expect(kyc.bvn_verified_at).to be_present
    expect(kyc.decrypted_bvn).to eq('12345678901')
    expect(kyc.verified_and_reusable_bvn?).to eq(true)
    expect(review.reload.status).to eq('approved')
  end
end
