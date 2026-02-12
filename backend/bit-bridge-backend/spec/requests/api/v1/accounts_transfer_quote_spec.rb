# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Accounts transfer quote', type: :request do
  let(:user) do
    create(
      :user,
      :confirmed,
      email: "transfer-quote-#{SecureRandom.hex(6)}@example.com",
      kyc_level: 'tier_2'
    )
  end
  let(:wallet) { user.ngn_wallet }

  before do
    wallet.transactions.create!(
      transaction_type: 'deposit',
      status: 'approved',
      amount: 5_000_000,
      coin_type: 'bank',
      address: 'Quote seed balance'
    )
  end

  def get_quote(amount:)
    get '/api/v1/accounts/transfer_quote',
        params: { amount: amount },
        headers: auth_headers(user)
  end

  it 'returns 403 with TIER_INELIGIBLE for Tier 1 users' do
    user.update!(kyc_level: 'tier_1')

    get_quote(amount: 1_000)

    expect(response).to have_http_status(:forbidden)
    body = JSON.parse(response.body)
    expect(body['error_code']).to eq('TIER_INELIGIBLE')
    expect(body['current_level']).to eq(1)
    expect(body['required_level']).to eq(2)
  end

  it 'returns 200 and Tier 2 daily limit' do
    user.update!(kyc_level: 'tier_2')

    get_quote(amount: 10_000)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['eligible']).to eq(true)
    expect(body['tier']).to eq('tier_2')
    expect(body['business_timezone']).to eq('Africa/Lagos')
    expect(body['day_start']).to be_present
    expect(body['day_end']).to be_present
    expect(body['daily_limit']).to eq(500_000.0)
    expect(body['currency']).to eq('NGN')
    expect(body['fee']).to be_a(Float)
    expect(body['total_debit']).to be_a(Float)
    expect(body['fee_is_estimate']).to eq(false)
    expect(body['as_of']).to be_present
    expect(Time.iso8601(body['as_of']).utc_offset).not_to eq(0)
  end

  it 'returns 200 and Tier 3 daily limit' do
    user.update!(kyc_level: 'tier_3')

    get_quote(amount: 10_000)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['tier']).to eq('tier_3')
    expect(body['daily_limit']).to eq(3_000_000.0)
  end

  it 'decreases daily remaining using approved anchor transfer components for today' do
    wallet.transactions.create!(
      transaction_type: 'withdrawal',
      status: 'approved',
      amount: 120_000,
      coin_type: 'bank',
      address: 'Anchor transfer principal',
      metadata: { provider: 'anchor', subtype: 'principal', transfer_reference: 'q-1' }
    )
    wallet.transactions.create!(
      transaction_type: 'withdrawal',
      status: 'approved',
      amount: 200,
      coin_type: 'bank',
      address: 'Anchor transfer fee',
      metadata: { provider: 'anchor', subtype: 'fee', transfer_reference: 'q-1' }
    )
    wallet.transactions.create!(
      transaction_type: 'withdrawal',
      status: 'approved',
      amount: 500,
      coin_type: 'bank',
      address: 'Other withdrawal',
      metadata: { provider: 'other', subtype: 'principal', transfer_reference: 'q-x' }
    )

    get_quote(amount: 5_000)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['daily_spent']).to eq(120_200.0)
    expect(body['daily_remaining']).to eq(379_800.0)
  end

  it 'returns 422 with AMOUNT_INVALID when amount is missing' do
    get_quote(amount: nil)

    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body['error_code']).to eq('AMOUNT_INVALID')
    expect(body['attempted_amount']).to be_nil
    expect(body['message']).to eq('amount must be a numeric value greater than 0')
  end

  it 'returns 422 with AMOUNT_INVALID for non-numeric amount' do
    get_quote(amount: 'not-a-number')

    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body['error_code']).to eq('AMOUNT_INVALID')
    expect(body['attempted_amount']).to eq('not-a-number')
    expect(body['message']).to eq('amount must be a numeric value greater than 0')
  end
end
