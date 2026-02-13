# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin::UnmatchedCredits', type: :request do
  include AuthHelpers

  it 'returns forbidden for non-admin user' do
    non_admin = create(:user, :confirmed)
    create(:unmatched_credit, provider: 'monnify', provider_reference: 'ref-forbidden')

    get '/api/v1/admin/unmatched_credits', headers: auth_headers(non_admin)

    expect(response).to have_http_status(:forbidden)
    body = response.parsed_body
    expect(body).to include(
      'success' => false,
      'error_code' => 'FORBIDDEN',
      'message' => 'Admin access required'
    )
  end

  it 'lists unmatched credits for admin' do
    admin = create(:user, :confirmed, role: 'admin')
    create(:unmatched_credit, provider: 'monnify', provider_reference: 'ref-1')

    get '/api/v1/admin/unmatched_credits', headers: auth_headers(admin)

    expect(response).to have_http_status(:ok)
    body = response.parsed_body
    expect(body['data']).to be_an(Array)
    expect(body['data'].first['provider_reference']).to eq('ref-1')
  end

  it 'marks unmatched credit reviewed with audit fields and request id' do
    admin = create(:user, :confirmed, role: 'admin')
    credit = create(:unmatched_credit, provider: 'monnify', provider_reference: 'ref-review', amount: 2500)

    patch "/api/v1/admin/unmatched_credits/#{credit.id}",
          params: { action_type: 'reviewed', review_note: 'Investigated and queued' },
          headers: auth_headers(admin)

    expect(response).to have_http_status(:ok)
    credit.reload
    expect(credit.status).to eq('ignored')
    expect(credit.reviewed_by_user_id).to eq(admin.id)
    expect(credit.reviewed_at).to be_present
    expect(credit.review_note).to eq('Investigated and queued')
    expect(credit.last_request_id).to eq(response.headers['X-Request-Id'])
  end

  it 'applies unmatched credit with audit fields and keeps audit immutable on duplicate apply' do
    admin = create(:user, :confirmed, role: 'admin')
    user = create(:user, :confirmed)
    wallet = user.wallet
    credit = create(:unmatched_credit, provider: 'monnify', provider_reference: 'ref-apply', amount: 1000)

    post "/api/v1/admin/unmatched_credits/#{credit.id}/apply",
         params: { wallet_id: wallet.id, apply_note: 'Applied to customer wallet' },
         headers: auth_headers(admin)

    expect(response).to have_http_status(:ok)
    credit.reload
    expect(credit.status).to eq('resolved')
    expect(credit.applied_by_user_id).to eq(admin.id)
    expect(credit.applied_at).to be_present
    expect(credit.apply_note).to eq('Applied to customer wallet')
    expect(credit.last_request_id).to eq(response.headers['X-Request-Id'])
    first_applied_at = credit.applied_at
    first_applied_by = credit.applied_by_user_id
    first_note = credit.apply_note
    first_request_id = credit.last_request_id

    post "/api/v1/admin/unmatched_credits/#{credit.id}/apply",
         params: { wallet_id: wallet.id },
         headers: auth_headers(admin)

    expect(response).to have_http_status(:conflict)
    body = response.parsed_body
    expect(body['error_code']).to eq('ALREADY_APPLIED')
    expect(body['success']).to eq(false)
    credit.reload
    expect(credit.applied_at).to eq(first_applied_at)
    expect(credit.applied_by_user_id).to eq(first_applied_by)
    expect(credit.apply_note).to eq(first_note)
    expect(credit.last_request_id).to eq(first_request_id)
  end
end
