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

    get '/api/v1/admin/ops/health', headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    anchor = body.dig('data', 'anchor')
    expect(anchor['webhook_secret_present']).to eq(true)
    expect(anchor['pending_withdrawals']).to eq(1)
    expect(anchor['oldest_pending_withdrawal_at']).to be_present
    expect(anchor['last_webhook_at']).to be_present
  end

  it 'rejects non-super-admin' do
    user = create(:user, role: 'support')

    get '/api/v1/admin/ops/health', headers: auth_headers(user)

    expect(response).to have_http_status(:forbidden)
  end
end
