# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin::UnmatchedCredits', type: :request do
  include AuthHelpers

  it 'lists unmatched credits for super admin only' do
    admin = create(:user, :confirmed, role: 'super_admin')
    create(:unmatched_credit, provider: 'monnify', provider_reference: 'ref-1')

    get '/api/v1/admin/unmatched_credits', headers: auth_headers(admin)

    expect(response).to have_http_status(:ok)
    body = response.parsed_body
    expect(body['data']).to be_an(Array)
    expect(body['data'].first['provider_reference']).to eq('ref-1')
  end

  it 'applies unmatched credit once and blocks duplicate apply' do
    admin = create(:user, :confirmed, role: 'super_admin')
    user = create(:user, :confirmed)
    wallet = user.wallet
    credit = create(:unmatched_credit, provider: 'monnify', provider_reference: 'ref-apply', amount: 1000)

    post "/api/v1/admin/unmatched_credits/#{credit.id}/apply",
         params: { wallet_id: wallet.id },
         headers: auth_headers(admin)

    expect(response).to have_http_status(:ok)
    expect(credit.reload.status).to eq('resolved')

    post "/api/v1/admin/unmatched_credits/#{credit.id}/apply",
         params: { wallet_id: wallet.id },
         headers: auth_headers(admin)

    expect(response).to have_http_status(:conflict)
    expect(response.parsed_body['error_code']).to eq('ALREADY_APPLIED')
  end
end

