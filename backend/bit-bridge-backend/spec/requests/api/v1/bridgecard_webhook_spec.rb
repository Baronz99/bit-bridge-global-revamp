# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Bridgecard webhook', type: :request do
  include ActiveJob::TestHelper
  let(:secret) { '00112233445566778899aabbccddeeff' }
  let(:user) { create(:user) }
  let!(:card) { Card.create!(user: user, card_id: 'card_123') }
  let!(:wallet) { Wallet.create!(user: user, wallet_type: 'usd', currency: 'USD', balance_cents: 200_000) }

  around do |example|
    original = ENV.to_h
    ENV['ENABLE_BRIDGE_CARDS'] = 'true'
    ENV['BRIDGECARD_TEST_WEBHOOK_SECRET'] = secret
    ActiveJob::Base.queue_adapter = :test
    example.run
    ENV.replace(original)
  end

  def sign_payload(body)
    key = [secret].pack('H*')
    if defined?(OpenSSL::CMAC)
      OpenSSL::CMAC.new('AES', key).update(body).hexdigest
    else
      OpenSSL::HMAC.hexdigest('SHA256', key, body)
    end
  end

  def post_webhook(payload)
    body = payload.to_json
    post '/api/v1/bridgecard/webhook',
         params: body,
         headers: {
           'CONTENT_TYPE' => 'application/json',
           'X-Webhook-Signature' => sign_payload(body)
         }
  end

  it 'upserts card debit events idempotently' do
    payload = {
      event: 'card_debit_event.failed',
      data: {
        card_id: card.card_id,
        cardholder_id: 'ch_123',
        transaction_reference: 'tx_1',
        bridgecard_transaction_reference: 'bc_tx_1',
        currency: 'USD',
        amount: 1200,
        card_transaction_type: 'DEBIT',
        transaction_date: '2024-01-01T00:00:00Z'
      }
    }

    expect do
      post_webhook(payload)
    end.to change(WebhookEvent, :count).by(1)
    expect do
      post_webhook(payload)
    end.to change(WebhookEvent, :count).by(0)

    expect(response).to have_http_status(:ok)
    expect(CardEvent.count).to eq(1)
    expect(CardEvent.first.event_status).to eq('failed')
    event = WebhookEvent.find_by(provider: 'bridgecard', reference: 'tx_1')
    expect(event).to be_present
    expect(event.signature_valid).to eq(true)
    expect(event.processing_status).to eq('processed')
  end

  it 'updates status when a later event arrives for same provider reference' do
    failed_payload = {
      event: 'card_debit_event.failed',
      data: {
        card_id: card.card_id,
        cardholder_id: 'ch_123',
        transaction_reference: 'tx_2',
        bridgecard_transaction_reference: 'bc_tx_2',
        currency: 'USD',
        amount: 1200,
        card_transaction_type: 'DEBIT',
        transaction_date: '2024-01-01T00:00:00Z'
      }
    }

    success_payload = failed_payload.merge(event: 'card_debit_event.successful')

    post_webhook(failed_payload)
    post_webhook(success_payload)

    expect(response).to have_http_status(:ok)
    expect(CardEvent.count).to eq(1)
    expect(CardEvent.first.event_status).to eq('successful')
  end

  it 'does not double debit on repeated successful debit events' do
    payload = {
      event: 'card_debit_event.successful',
      data: {
        card_id: card.card_id,
        cardholder_id: 'ch_123',
        transaction_reference: 'tx_3',
        bridgecard_transaction_reference: 'bc_tx_3',
        currency: 'USD',
        amount: 25,
        card_transaction_type: 'DEBIT',
        transaction_date: '2024-01-01T00:00:00Z'
      }
    }

    post_webhook(payload)
    txns_after_first = wallet.transactions.where("metadata ->> 'transfer_reference' = ?", 'bc_tx_3').count

    post_webhook(payload)
    txns_after_second = wallet.transactions.where("metadata ->> 'transfer_reference' = ?", 'bc_tx_3').count

    expect(txns_after_second).to eq(txns_after_first)
  end

  it 'enqueues enrichment job for debit events' do
    payload = {
      event: 'card_debit_event.successful',
      data: {
        card_id: card.card_id,
        cardholder_id: 'ch_123',
        transaction_reference: 'tx_4',
        bridgecard_transaction_reference: 'bc_tx_4',
        currency: 'USD',
        amount: 10,
        card_transaction_type: 'DEBIT',
        transaction_date: '2024-01-01T00:00:00Z'
      }
    }

    expect {
      post_webhook(payload)
    }.to have_enqueued_job(Bridgecard::EnrichTransactionJob)
  end
end
