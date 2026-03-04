# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Anchor NGN transfers', type: :request do
  let(:user) do
    user = User.create!(
      email: "anchor-transfer-#{SecureRandom.hex(6)}@example.com",
      password: 'password123',
      password_confirmation: 'password123',
      kyc_level: 'tier_2',
      confirmed_at: Time.current
    )
    user.set_transaction_pin!('1234')
    user
  end
  let(:wallet) { user.ngn_wallet }

  let!(:anchor_account) do
    Account.create!(
      user: user,
      vendor: 'anchor',
      account_number: '1234567890',
      account_name: 'Test User',
      bank_code: '000',
      bank_name: 'Test Bank',
      currency: 'NGN',
      useable_id: 'anchor_use_1'
    )
  end

  before do
    wallet.transactions.create!(
      transaction_type: 'deposit',
      status: 'approved',
      amount: 20_000,
      coin_type: 'bank',
      address: 'Seed balance'
    )
  end

  # Payload contract (matches web):
  # {
  #   account: {
  #     amount: Numeric (Naira),
  #     bank_code: String,
  #     bank: String,
  #     account_number: String(10),
  #     account_name: String,
  #     inter_bank: Boolean,
  #     description: String,
  #     pin: String(4),
  #     transfer_reference: String optional
  #   }
  # }
  def base_transfer_payload(amount)
    {
      amount: amount,
      bank_code: '000',
      bank: 'Test Bank',
      account_number: '1234567890',
      account_name: 'Jane Doe',
      counter_party_id: 'cp_123',
      inter_bank: true,
      description: 'Test transfer',
      pin: '1234'
    }
  end

  def post_transfer(amount, extra = {}, remove_keys: [])
    payload = base_transfer_payload(amount).merge(extra)
    remove_keys.each { |key| payload.delete(key) }

    post '/api/v1/accounts/initiate_fund_transfer',
         params: {
           account: payload
         },
         headers: auth_headers(user)
  end

  it 'rejects amount below minimum' do
    post_transfer(100)

    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body['message']).to eq('Minimum transfer amount is 150.')
    expect(body['error_code']).to eq('transfer_amount_below_minimum')
    expect(body['min_amount']).to eq(150)
  end

  it 'rejects malformed amount with 422 and does not create transactions' do
    expect do
      post_transfer('junk')
    end.not_to change(Transaction, :count)

    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body['message']).to eq('amount must be greater than 0')
    expect(body['error_code']).to eq('amount_invalid')
  end

  it 'returns insufficient funds payload when balance is too low' do
    post_transfer(100_000)

    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body['error_code']).to eq('transfer_insufficient_balance')
    expect(body['required_total']).to be_present
    expect(body['available_balance']).to be_present
    expect(body['fee_breakdown']).to be_present
  end

  it 'accepts minimal valid payload as web sends' do
    anchor_service = instance_double(AnchorService)
    allow(AnchorService).to receive(:new).and_return(anchor_service)
    allow(anchor_service).to receive(:initiate_transfer).and_return(
      status: :ok,
      data: { transfer_id: 'tr_abc', status: 'pending' }
    )

    post_transfer(500)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['transfer_reference']).to be_present
  end

  it 'returns deterministic 422 when account_name is missing' do
    post_transfer(500, { account_name: '' })

    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body['message']).to eq('account_name is required. Resolve account details first.')
    expect(body['error_code']).to eq('account_name_required')
  end

  it 'returns deterministic 422 when bank is missing' do
    post_transfer(500, { bank: '' })

    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body['message']).to eq('bank is required')
    expect(body['error_code']).to eq('bank_required')
  end

  it 'returns deterministic 422 when description is missing' do
    post_transfer(500, { description: '' })

    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body['message']).to eq('description is required')
    expect(body['error_code']).to eq('description_required')
  end

  it 'returns deterministic 422 when inter_bank is missing' do
    post_transfer(500, {}, remove_keys: [:inter_bank])

    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body['message']).to eq('inter_bank is required and must be boolean')
    expect(body['error_code']).to eq('inter_bank_required')
  end

  it 'returns deterministic 422 when inter_bank is not boolean-like' do
    post_transfer(500, { inter_bank: 'maybe' })

    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body['message']).to eq('inter_bank must be boolean')
    expect(body['error_code']).to eq('inter_bank_invalid')
  end

  it 'returns 422 when pin is missing' do
    post_transfer(500, {}, remove_keys: [:pin])

    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body['message']).to eq('Transaction PIN is required')
    expect(body['error_code']).to eq('transaction_pin_required')
  end

  it 'blocks Tier 1 users from initiating transfer' do
    user.update!(kyc_level: 'tier_1')
    post_transfer(500)

    expect(response).to have_http_status(:forbidden)
    body = JSON.parse(response.body)
    expect(body['error_code']).to eq('TIER_INELIGIBLE')
    expect(body['required_level']).to eq('tier_2')
  end

  it 'returns 422 when pin is invalid' do
    post_transfer(500, { pin: '0000' })

    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body['message']).to eq('Invalid transaction PIN')
    expect(body['error_code']).to eq('transaction_pin_invalid')
    expect(body['attempts_remaining']).to be <= 4
  end

  it 'returns 429 after lockout threshold is exceeded' do
    5.times { post_transfer(500, { pin: '0000' }) }
    post_transfer(500, { pin: '0000' })

    expect(response).to have_http_status(:too_many_requests)
    body = JSON.parse(response.body)
    expect(body['error_code']).to eq('transaction_pin_locked')
    expect(body['locked']).to eq(true)
    expect(body['retry_after_seconds']).to be > 0
  end

  it 'creates pending ledger entries and returns approved/pending status on success' do
    anchor_service = instance_double(AnchorService)
    allow(AnchorService).to receive(:new).and_return(anchor_service)
    allow(anchor_service).to receive(:initiate_transfer).and_return(
      status: :ok,
      data: { transfer_id: 'tr_123', status: 'pending' }
    )

    post_transfer(10_000)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['transfer_reference']).to be_present
    expect(body['fee_breakdown']).to be_present
    expect(body['provider']).to eq('anchor')

    principal = wallet.transactions.where("metadata ->> 'subtype' = ?", 'principal').last
    fee = wallet.transactions.where("metadata ->> 'subtype' = ?", 'fee').last
    expect(principal).to be_present
    expect(fee).to be_present
    expect(principal.unique_transaction_id).to include(':principal')
    expect(fee.unique_transaction_id).to include(':fee')
  end

  it 'reuses transfer_reference without creating duplicate debits' do
    anchor_service = instance_double(AnchorService)
    allow(AnchorService).to receive(:new).and_return(anchor_service)
    allow(anchor_service).to receive(:initiate_transfer).and_return(
      status: :ok,
      data: { transfer_id: 'tr_123', status: 'pending' }
    )

    transfer_reference = 'ref-123'
    post_transfer(10_000, { transfer_reference: transfer_reference })
    expect(response).to have_http_status(:ok)
    first_body = JSON.parse(response.body)

    initial_count = wallet.transactions.where("metadata ->> 'transfer_reference' = ?", transfer_reference).count

    post_transfer(10_000, { transfer_reference: transfer_reference })
    expect(response).to have_http_status(:ok)
    second_body = JSON.parse(response.body)

    final_count = wallet.transactions.where("metadata ->> 'transfer_reference' = ?", transfer_reference).count
    expect(final_count).to eq(initial_count)
    expect(second_body['transfer_reference']).to eq(first_body['transfer_reference'])
    expect(second_body['message']).to eq('Transfer already processed')
  end

  it 'enforces Tier 2 daily transfer limit at 500,000 NGN' do
    user.update!(kyc_level: 'tier_2')
    anchor_service = instance_double(AnchorService)
    allow(AnchorService).to receive(:new).and_return(anchor_service)
    allow(anchor_service).to receive(:initiate_transfer).and_return(
      status: :ok,
      data: { transfer_id: 'tr_tier2', status: 'approved' }
    )
    allow(Transfers::NgnTransferDailyLimit).to receive(:snapshot).and_return(
      {
        daily_limit: 500_000.to_d,
        daily_spent: 499_850.to_d,
        daily_remaining: 150.to_d,
        attempted_amount: 150.to_d,
        exceeded: false
      },
      {
        daily_limit: 500_000.to_d,
        daily_spent: 500_000.to_d,
        daily_remaining: 0.to_d,
        attempted_amount: 150.to_d,
        exceeded: true
      }
    )

    post_transfer(150, { transfer_reference: 'tier2-allowed' })
    expect(response).to have_http_status(:ok)

    post_transfer(150, { transfer_reference: 'tier2-blocked' })
    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body['error_code']).to eq('DAILY_LIMIT_EXCEEDED')
    expect(body['daily_limit']).to eq(500_000.0)
    expect(body['daily_spent']).to eq(500_000.0)
    expect(body['daily_remaining']).to eq(0.0)
    expect(body['attempted_amount']).to eq(150.0)
  end

  it 'enforces Tier 3 daily transfer limit at 3,000,000 NGN' do
    user.update!(kyc_level: 'tier_3')
    anchor_service = instance_double(AnchorService)
    allow(AnchorService).to receive(:new).and_return(anchor_service)
    allow(anchor_service).to receive(:initiate_transfer).and_return(
      status: :ok,
      data: { transfer_id: 'tr_tier3', status: 'approved' }
    )
    allow(Transfers::NgnTransferDailyLimit).to receive(:snapshot).and_return(
      {
        daily_limit: 3_000_000.to_d,
        daily_spent: 2_999_850.to_d,
        daily_remaining: 150.to_d,
        attempted_amount: 150.to_d,
        exceeded: false
      },
      {
        daily_limit: 3_000_000.to_d,
        daily_spent: 3_000_000.to_d,
        daily_remaining: 0.to_d,
        attempted_amount: 150.to_d,
        exceeded: true
      }
    )

    post_transfer(150, { transfer_reference: 'tier3-allowed' })
    expect(response).to have_http_status(:ok)

    post_transfer(150, { transfer_reference: 'tier3-blocked' })
    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body['error_code']).to eq('DAILY_LIMIT_EXCEEDED')
    expect(body['daily_limit']).to eq(3_000_000.0)
    expect(body['daily_spent']).to eq(3_000_000.0)
    expect(body['daily_remaining']).to eq(0.0)
    expect(body['attempted_amount']).to eq(150.0)
  end

  it 'does not create a beneficiary unless save_beneficiary is true' do
    anchor_service = instance_double(AnchorService)
    allow(AnchorService).to receive(:new).and_return(anchor_service)
    allow(anchor_service).to receive(:initiate_transfer).and_return(
      status: :ok,
      data: { transfer_id: 'tr_123', status: 'pending' }
    )

    expect {
      post_transfer(10_000)
    }.not_to change(Beneficiary, :count)

    expect {
      post_transfer(10_000, { save_beneficiary: true })
    }.to change(Beneficiary, :count).by(1)
  end

  it 'marks failed and releases hold without reversal deposit entries on provider failure' do
    anchor_service = instance_double(AnchorService)
    allow(AnchorService).to receive(:new).and_return(anchor_service)
    allow(anchor_service).to receive(:initiate_transfer).and_return(
      status: :bad_request,
      message: 'Anchor failed'
    )

    post_transfer(10_000)

    expect(response).to have_http_status(:bad_gateway)
    reversals = wallet.transactions.where("metadata ->> 'subtype' = ?", 'reversal')
    expect(reversals.count).to eq(0)
    transfer_reference = JSON.parse(response.body)['transfer_reference']
    order = BillOrder.find_by(user: user, meter_number: transfer_reference)
    release = WalletLedgerEntry.find_by(wallet: wallet, bill_order: order, entry_type: :release)
    expect(release).to be_present
  end

  it 'does not create a beneficiary when transfer fails even if save_beneficiary is true' do
    anchor_service = instance_double(AnchorService)
    allow(AnchorService).to receive(:new).and_return(anchor_service)
    allow(anchor_service).to receive(:initiate_transfer).and_return(
      status: :bad_request,
      message: 'Anchor failed'
    )

    expect {
      post_transfer(10_000, { save_beneficiary: true })
    }.not_to change(Beneficiary, :count)
  end

  it 'normalizes provider parser and gateway errors for customer-facing transfer failures' do
    anchor_service = instance_double(AnchorService)
    allow(AnchorService).to receive(:new).and_return(anchor_service)
    allow(anchor_service).to receive(:initiate_transfer).and_return(
      status: :bad_request,
      message: "undefined method 'dig' for #<HTTParty::Response parsed_response=\"<html><title>502 Bad Gateway</title></html>\">"
    )

    post_transfer(10_000)

    expect(response).to have_http_status(:bad_gateway)
    body = JSON.parse(response.body)
    expect(body['message']).to eq('Transfer provider is temporarily unavailable. Please retry shortly.')
    expect(body['error_code']).to eq('transfer_provider_unavailable')
  end
end
