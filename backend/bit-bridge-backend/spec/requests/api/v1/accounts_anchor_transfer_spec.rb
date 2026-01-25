# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Anchor NGN transfers', type: :request do
  let(:user) { create(:user, :tier2, :with_pin) }
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

  def post_transfer(amount, extra = {})
    post '/api/v1/accounts/initiate_fund_transfer',
         params: {
           account: {
             amount: amount,
             bank_code: '000',
             bank: 'Test Bank',
             account_number: '1234567890',
             account_name: 'Jane Doe',
             counter_party_id: 'cp_123',
             inter_bank: true,
             description: 'Test transfer',
             pin: '1234'
           }.merge(extra)
         },
         headers: auth_headers(user)
  end

  it 'rejects amount below minimum' do
    post_transfer(100)

    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body['message']).to eq('Minimum transfer amount is 150.')
    expect(body['min_amount']).to eq(150)
  end

  it 'rejects malformed amount with 422 and does not create transactions' do
    expect do
      post_transfer('junk')
    end.not_to change(Transaction, :count)

    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body['message']).to eq('amount must be greater than 0')
  end

  it 'returns insufficient funds payload when balance is too low' do
    post_transfer(100_000)

    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body['required_total']).to be_present
    expect(body['available_balance']).to be_present
    expect(body['fee_breakdown']).to be_present
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

    initial_count = wallet.transactions.where("metadata ->> 'transfer_reference' = ?", transfer_reference).count

    post_transfer(10_000, { transfer_reference: transfer_reference })
    expect(response).to have_http_status(:ok)

    final_count = wallet.transactions.where("metadata ->> 'transfer_reference' = ?", transfer_reference).count
    expect(final_count).to eq(initial_count)
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

  it 'marks failed and creates reversal entries on provider failure' do
    anchor_service = instance_double(AnchorService)
    allow(AnchorService).to receive(:new).and_return(anchor_service)
    allow(anchor_service).to receive(:initiate_transfer).and_return(
      status: :bad_request,
      message: 'Anchor failed'
    )

    post_transfer(10_000)

    expect(response).to have_http_status(:bad_gateway)
    reversals = wallet.transactions.where("metadata ->> 'subtype' = ?", 'reversal')
    expect(reversals.count).to eq(2)
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
end
