# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin KYC reviews', type: :request do
  let(:admin) { create(:user, role: 'admin', admin_role: 'compliance') }
  let(:headers) { auth_headers(admin) }
  let(:user) { create(:user) }

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
end
