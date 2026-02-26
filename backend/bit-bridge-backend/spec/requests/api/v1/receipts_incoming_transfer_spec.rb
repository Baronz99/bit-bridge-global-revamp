# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Incoming transfer receipts', type: :request do
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

  def create_incoming_transfer!(reference: 'fbg-12345')
    wallet = build_wallet(user, currency: 'NGN')
    tx = Transaction.create!(
      wallet: wallet,
      amount: 1500,
      transaction_type: :deposit,
      status: :approved,
      address: 'Incoming transfer',
      metadata: {
        provider: 'monnify',
        purpose: 'wallet_fund',
        nibss_session_id: 'sess-001'
      }
    )

    record = TransactionRecord.create!(
      reference: reference,
      exchange: tx,
      amount: 1500,
      event_type: 'monnify.webhook.successful_transaction',
      transaction_id: 'prov-123',
      customer_name: 'Alice Sender',
      account_number: '0123456789',
      bank: 'Demo Bank'
    )

    [tx, record]
  end

  it 'returns explicit incoming transfer fields when fetched by canonical reference' do
    _tx, record = create_incoming_transfer!

    get "/api/v1/receipts/#{record.reference}", headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    data = body['data']

    expect(data['title']).to eq('Incoming bank transfer')
    expect(data.dig('meta', 'receipt_category')).to eq('incoming_transfer')
    expect(data.dig('meta', 'transaction_direction')).to eq('inbound')
    expect(data.dig('meta', 'incoming_transfer', 'provider_name')).to eq('monnify')
    expect(data.dig('meta', 'incoming_transfer', 'provider_reference')).to eq('prov-123')
    expect(data.dig('meta', 'incoming_transfer', 'session_id')).to eq('sess-001')
    expect(data.dig('meta', 'incoming_transfer', 'sender_name')).to eq('Alice Sender')
    expect(data.dig('meta', 'incoming_transfer', 'sender_bank_name')).to eq('Demo Bank')
    expect(data.dig('meta', 'incoming_transfer', 'sender_account_number')).to eq('0123456789')
    expect(data.dig('meta', 'incoming_transfer', 'timestamps', 'credited_at')).to be_present
  end

  it 'returns explicit incoming transfer fields when fetched by wallet timeline id' do
    tx, _record = create_incoming_transfer!(reference: 'fbg-98765')

    get "/api/v1/receipts/wallet-tx-#{tx.id}", headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    data = body['data']

    expect(data['title']).to eq('Incoming bank transfer')
    expect(data.dig('meta', 'receipt_category')).to eq('incoming_transfer')
    expect(data.dig('meta', 'incoming_transfer', 'provider_name')).to eq('monnify')
    expect(data.dig('meta', 'incoming_transfer', 'sender_name')).to eq('Alice Sender')
  end
end
