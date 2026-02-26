# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Outgoing transfer receipts', type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers(user) }

  def build_wallet(user, currency: 'NGN')
    wallet_type = currency.downcase == 'usd' ? :usd : :ngn
    wallet = Wallet.find_or_initialize_by(user: user, wallet_type: wallet_type)
    wallet.currency = currency
    wallet.balance_cents ||= 1_000_000
    wallet.save!
    wallet
  end

  def create_outgoing_transfer!(reference: 'trf-12345', status: :declined, lifecycle_state: nil)
    wallet = build_wallet(user, currency: 'NGN')
    if status.to_s != 'declined'
      Transaction.create!(
        wallet: wallet,
        amount: 10_000,
        transaction_type: :deposit,
        status: :approved,
        address: 'Seed wallet for withdrawal test',
        metadata: { purpose: 'seed_test_balance' }
      )
    end

    metadata = {
      provider: 'anchor',
      subtype: 'principal',
      transfer_reference: reference,
      provider_transfer_id: 'anc-trf-001'
    }
    metadata[:lifecycle_state] = lifecycle_state if lifecycle_state.present?

    tx = Transaction.create!(
      wallet: wallet,
      amount: 2500,
      transaction_type: :withdrawal,
      status: status,
      address: 'Transfer to beneficiary',
      metadata: metadata
    )

    record = TransactionRecord.create!(
      reference: reference,
      exchange: tx,
      amount: 2500,
      event_type: 'anchor.transfer.create',
      transaction_id: 'anc-trf-001',
      customer_name: 'John Recipient',
      account_number: '0123456789',
      bank: 'Demo Bank'
    )

    [tx, record]
  end

  it 'returns explicit outgoing transfer fields when fetched by canonical reference' do
    _tx, record = create_outgoing_transfer!

    get "/api/v1/receipts/#{record.reference}", headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    data = body['data']

    expect(data['title']).to eq('Bank transfer')
    expect(data.dig('meta', 'receipt_category')).to eq('outgoing_transfer')
    expect(data.dig('meta', 'transaction_direction')).to eq('outbound')
    expect(data.dig('meta', 'outgoing_transfer', 'provider_name')).to eq('anchor')
    expect(data.dig('meta', 'outgoing_transfer', 'provider_reference')).to eq('anc-trf-001')
    expect(data.dig('meta', 'outgoing_transfer', 'beneficiary_name')).to eq('John Recipient')
    expect(data.dig('meta', 'outgoing_transfer', 'beneficiary_bank_name')).to eq('Demo Bank')
    expect(data.dig('meta', 'outgoing_transfer', 'beneficiary_account_number')).to eq('0123456789')
    expect(data.dig('meta', 'beneficiary')).to eq('John Recipient')
    expect(data.dig('meta', 'bankName')).to eq('Demo Bank')
    expect(data.dig('meta', 'accountNumber')).to eq('0123456789')
  end

  it 'returns explicit outgoing transfer fields when fetched by wallet timeline id' do
    tx, _record = create_outgoing_transfer!(reference: 'trf-98765')

    get "/api/v1/receipts/wallet-tx-#{tx.id}", headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    data = body['data']

    expect(data['title']).to eq('Bank transfer')
    expect(data.dig('meta', 'receipt_category')).to eq('outgoing_transfer')
    expect(data.dig('meta', 'transaction_direction')).to eq('outbound')
    expect(data.dig('meta', 'outgoing_transfer', 'beneficiary_name')).to eq('John Recipient')
  end

  it 'uses success subtitle for approved outbound transfers' do
    _tx, record = create_outgoing_transfer!(reference: 'trf-success-1', status: :approved)

    get "/api/v1/receipts/#{record.reference}", headers: headers

    expect(response).to have_http_status(:ok)
    data = JSON.parse(response.body)['data']
    expect(data['subtitle']).to eq('Funds sent to recipient bank account')
  end

  it 'uses pending subtitle for processing outbound transfers' do
    _tx, record = create_outgoing_transfer!(reference: 'trf-pending-1', status: :pending)

    get "/api/v1/receipts/#{record.reference}", headers: headers

    expect(response).to have_http_status(:ok)
    data = JSON.parse(response.body)['data']
    expect(data['subtitle']).to eq('Transfer is being processed by provider')
  end

  it 'uses refunded subtitle when lifecycle state is failed_refunded' do
    _tx, record = create_outgoing_transfer!(
      reference: 'trf-failed-refunded-1',
      status: :failed,
      lifecycle_state: 'failed_refunded'
    )

    get "/api/v1/receipts/#{record.reference}", headers: headers

    expect(response).to have_http_status(:ok)
    data = JSON.parse(response.body)['data']
    expect(data['subtitle']).to eq('Transfer failed. Funds returned to wallet')
  end

  it 'uses reversal subtitle when lifecycle state is failed_reversal_pending' do
    _tx, record = create_outgoing_transfer!(
      reference: 'trf-reversal-pending-1',
      status: :failed,
      lifecycle_state: 'failed_reversal_pending'
    )

    get "/api/v1/receipts/#{record.reference}", headers: headers

    expect(response).to have_http_status(:ok)
    data = JSON.parse(response.body)['data']
    expect(data['subtitle']).to eq('Transfer failed. Reversal in progress')
  end

  it 'does not double count aggregate total_fee when component fees are present' do
    wallet = build_wallet(user, currency: 'NGN')
    transfer_reference = "trf-fee-#{SecureRandom.hex(4)}"
    principal_tx = Transaction.create!(
      wallet: wallet,
      amount: 15_000,
      transaction_type: :withdrawal,
      status: :declined,
      address: 'Transfer to beneficiary',
      metadata: {
        provider: 'anchor',
        subtype: 'principal',
        transfer_reference: transfer_reference
      }
    )
    Transaction.create!(
      wallet: wallet,
      amount: 85,
      transaction_type: :withdrawal,
      status: :declined,
      address: "Anchor transfer fee (#{transfer_reference})",
      metadata: {
        provider: 'anchor',
        subtype: 'fee',
        transfer_reference: transfer_reference,
        fee_breakdown: {
          platform_fee: 35,
          stamp_duty_fee: 50,
          total_fee: 85
        }
      }
    )

    get "/api/v1/receipts/wallet-tx-#{principal_tx.id}", headers: headers

    expect(response).to have_http_status(:ok)
    data = JSON.parse(response.body)['data']
    labels = Array(data['fees']).map { |f| f['label'].to_s.downcase }
    total_fees = Array(data['fees']).sum { |f| f['amount'].to_d }

    expect(labels).to include('transfer fee', 'stamp duty')
    expect(labels).not_to include('total fee')
    expect(total_fees).to eq(85.to_d)
  end
end
