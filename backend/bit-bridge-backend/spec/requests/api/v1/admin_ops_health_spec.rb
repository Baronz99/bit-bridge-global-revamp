# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin ops health', type: :request do
  let(:admin) { create(:user, role: 'super_admin') }
  let(:headers) { auth_headers(admin) }

  around do |example|
    original = ENV.to_h
    ENV['ANCHOR_WEBHOOK_SECRET'] = 'secret'
    example.run
    ENV.replace(original)
  end

  it 'returns anchor health summary' do
    user = create(:user)
    wallet = Wallet.create!(user: user, wallet_type: :usd, currency: 'USD', balance_cents: 50_000)
    Transaction.create!(
      wallet: wallet,
      transaction_type: 'withdrawal',
      status: 'pending',
      amount: 100,
      address: 'bank',
      transfer_id: 'tr_123',
      metadata: { provider: 'anchor', subtype: 'principal', transfer_reference: 'ref_123' }
    )
    AnchorWebhookEvent.create!(event_type: 'payment.received', reference: 'evt_1')
    stale_user = create(:user, email: 'stale-bvn@example.com', kyc_level: 'tier_2', onboarding_stage: 'use_case_selected')
    UserKyc.create!(
      user: stale_user,
      bvn_status: 'verified',
      bvn_verified_at: Time.current,
      bvn_encrypted: nil
    )
    Account.create!(
      user: stale_user,
      vendor: 'anchor',
      account_type: :individual,
      status: :completed,
      account_number: '1234567890',
      account_id: 'anc_customer_1'
    )

    get '/api/v1/admin/ops/health', headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    anchor = body.dig('data', 'anchor')
    kyc_reuse = body.dig('data', 'kyc_reuse')
    expect(anchor['webhook_secret_present']).to eq(true)
    expect(anchor['pending_withdrawals']).to eq(1)
    expect(anchor['oldest_pending_withdrawal_at']).to be_present
    expect(anchor['last_webhook_at']).to be_present
    expect(kyc_reuse['verified_bvn_total']).to eq(1)
    expect(kyc_reuse['reusable_bvn_total']).to eq(0)
    expect(kyc_reuse['verified_missing_reusable_bvn_count']).to eq(1)
    sample = kyc_reuse['stale_verified_bvn_sample'].first
    expect(sample['email']).to eq('stale-bvn@example.com')
    expect(sample['has_anchor_account']).to eq(true)
    expect(sample['anchor_account_provisioned']).to eq(true)
    expect(sample['has_cardholder_profile']).to eq(false)
    expect(sample['has_cards']).to eq(false)
    expect(sample['recommended_action']).to eq('monitor_anchor_safe_cards_risky')
  end

  it 'rejects non-super-admin' do
    user = create(:user, role: 'support')

    get '/api/v1/admin/ops/health', headers: auth_headers(user)

    expect(response).to have_http_status(:forbidden)
  end

  it 'returns user-specific kyc reuse triage' do
    stale_user = create(:user, email: 'triage-bvn@example.com', kyc_level: 'tier_2', onboarding_stage: 'use_case_selected')
    UserKyc.create!(
      user: stale_user,
      bvn_status: 'verified',
      bvn_verified_at: Time.current,
      bvn_encrypted: nil
    )
    Account.create!(
      user: stale_user,
      vendor: 'anchor',
      account_type: :individual,
      status: :completed,
      account_number: '1234567890',
      account_id: 'anc_customer_2'
    )

    get "/api/v1/admin/ops/health/users/#{stale_user.id}", headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    triage = body.dig('data', 'kyc_reuse')
    expect(triage['email']).to eq('triage-bvn@example.com')
    expect(triage['bvn_verified']).to eq(true)
    expect(triage['reusable_bvn_available']).to eq(false)
    expect(triage['needs_review']).to eq(true)
    expect(triage['has_anchor_account']).to eq(true)
    expect(triage['anchor_account_provisioned']).to eq(true)
    expect(triage['recommended_action']).to eq('monitor_anchor_safe_cards_risky')
  end
end
