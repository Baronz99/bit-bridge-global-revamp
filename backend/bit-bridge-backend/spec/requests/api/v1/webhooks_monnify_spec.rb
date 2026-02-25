# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Monnify webhook', type: :request do
  MONNIFY_TEST_SECRET = 'test-monnify-secret'

  around do |example|
    previous = ENV['MONNIFY_WEBHOOK_SECRET']
    ENV['MONNIFY_WEBHOOK_SECRET'] = MONNIFY_TEST_SECRET
    example.run
  ensure
    ENV['MONNIFY_WEBHOOK_SECRET'] = previous
  end

  def monnify_signature_for(payload)
    OpenSSL::HMAC.hexdigest('sha512', MONNIFY_TEST_SECRET, payload.to_json)
  end

  def post_webhook(payload, signature: nil)
    header_signature = signature.nil? ? monnify_signature_for(payload) : signature
    post '/api/v1/monnify/webhook',
         params: payload.to_json,
         headers: {
           'CONTENT_TYPE' => 'application/json',
           'monnify-signature' => header_signature
         }
  end

  def build_payload(user_id:, overrides: {})
    {
      eventType: 'SUCCESSFUL_TRANSACTION',
      eventData: {
        paymentStatus: 'PAID',
        paymentReference: 'mon-123',
        transactionReference: 'tx-123',
        currencyCode: 'NGN',
        product: { reference: user_id },
        paymentSourceInformation: [
          {
            amountPaid: 15000,
            accountNumber: '0123456789',
            accountName: 'Jane Doe',
            bankCode: '058',
            bankName: 'Test Bank'
          }
        ]
      }
    }.deep_merge(overrides)
  end

  it 'does not create duplicate deposits for repeated references' do
    user = create(:user)
    user.ngn_wallet

    payload = build_payload(user_id: user.id)

    expect do
      post_webhook(payload)
    end.to change(Transaction, :count).by(1)
      .and change(TransactionRecord, :count).by(1)
      .and change(WebhookEvent, :count).by(1)

    expect(response).to have_http_status(:ok)

    expect do
      post_webhook(payload)
    end.not_to change(Transaction, :count)
    expect(WebhookEvent.count).to eq(1)

    expect(response).to have_http_status(:ok)
    record = TransactionRecord.find_by(reference: 'mon-123')
    expect(record).to be_present
    expect(record.event_type).to start_with('monnify.webhook')
    event = WebhookEvent.find_by(provider: 'monnify', reference: 'mon-123')
    expect(event).to be_present
    expect(event.processing_status).to eq('processed')
  end

  it 'rejects webhook when signature is invalid' do
    user = create(:user)
    user.ngn_wallet
    payload = build_payload(user_id: user.id)

    expect do
      post_webhook(payload, signature: 'bad-signature')
    end.to change(WebhookEvent, :count).by(1)

    expect(response).to have_http_status(:unauthorized)
    expect(Transaction.count).to eq(0)
    expect(TransactionRecord.count).to eq(0)
    event = WebhookEvent.where(provider: 'monnify').order(created_at: :desc).first
    expect(event.signature_valid).to eq(false)
    expect(event.processing_status).to eq('rejected')
  end

  it 'does not create deposits when payment status is pending' do
    user = create(:user)
    wallet = user.ngn_wallet
    starting_total = wallet.ledger_deposits_total
    payload = build_payload(user_id: user.id, overrides: { eventData: { paymentStatus: 'PENDING' } })

    starting_tx = Transaction.count
    starting_records = TransactionRecord.count
    post_webhook(payload)

    expect(response).to have_http_status(:ok)
    expect(Transaction.count).to eq(starting_tx)
    expect(TransactionRecord.count).to eq(starting_records)
    expect(wallet.reload.ledger_deposits_total).to eq(starting_total)
  end

  it 'does not create deposits when payment status is failed or cancelled' do
    user = create(:user)
    wallet = user.ngn_wallet
    starting_total = wallet.ledger_deposits_total

    %w[FAILED CANCELLED].each do |status|
      payload = build_payload(user_id: user.id, overrides: { eventData: { paymentStatus: status } })

      starting_tx = Transaction.count
      starting_records = TransactionRecord.count
      post_webhook(payload)
      expect(response).to have_http_status(:ok)
      expect(Transaction.count).to eq(starting_tx)
      expect(TransactionRecord.count).to eq(starting_records)
      expect(wallet.reload.ledger_deposits_total).to eq(starting_total)
    end
  end

  it 'does not create deposits when required references are missing' do
    user = create(:user)
    wallet = user.ngn_wallet
    starting_total = wallet.ledger_deposits_total
    payload = build_payload(
      user_id: user.id,
      overrides: { eventData: { paymentReference: nil, transactionReference: nil, product: { reference: nil } } }
    )

    starting_tx = Transaction.count
    starting_records = TransactionRecord.count
    post_webhook(payload)
    expect(response).to have_http_status(:ok)
    expect(Transaction.count).to eq(starting_tx)
    expect(TransactionRecord.count).to eq(starting_records)
    expect(wallet.reload.ledger_deposits_total).to eq(starting_total)
  end

  it 'returns 4xx and does not create deposits when amount is malformed' do
    user = create(:user)
    wallet = user.ngn_wallet
    starting_total = wallet.ledger_deposits_total
    payload = build_payload(
      user_id: user.id,
      overrides: { eventData: { paymentSourceInformation: [{ amountPaid: 'junk' }] } }
    )

    starting_tx = Transaction.count
    starting_records = TransactionRecord.count
    post_webhook(payload)
    expect(response).to have_http_status(:unprocessable_entity)
    expect(Transaction.count).to eq(starting_tx)
    expect(TransactionRecord.count).to eq(starting_records)
    expect(wallet.reload.ledger_deposits_total).to eq(starting_total)
  end

  it 'stores unmatched credit when user mapping cannot be resolved' do
    payload = build_payload(user_id: 'missing-user-id', overrides: { eventData: { paymentReference: 'mon-unmatched-1' } })

    expect do
      post_webhook(payload)
    end.to change(UnmatchedCredit, :count).by(1)

    expect(response).to have_http_status(:ok)
    unmatched = UnmatchedCredit.find_by(provider: 'monnify', provider_reference: 'tx-123')
    expect(unmatched).to be_present
    expect(unmatched.reason).to eq('user_not_found')
    expect(unmatched.status).to eq('pending')
  end

  it 'normalizes monnify kobo amounts' do
    controller = Api::V1::WebhooksController.new
    original_scale = ENV['MONNIFY_AMOUNT_SCALE']
    ENV['MONNIFY_AMOUNT_SCALE'] = 'kobo'

    amount, scale = controller.send(:normalize_monnify_amount, '1050', 'NGN')

    expect(amount).to eq(BigDecimal('1050'))
    expect(scale).to eq('naira')
  ensure
    ENV['MONNIFY_AMOUNT_SCALE'] = original_scale
  end

  it 'keeps naira amounts when configured' do
    controller = Api::V1::WebhooksController.new
    original_scale = ENV['MONNIFY_AMOUNT_SCALE']
    ENV['MONNIFY_AMOUNT_SCALE'] = 'naira'

    amount, scale = controller.send(:normalize_monnify_amount, '1050', 'NGN')

    expect(amount).to eq(BigDecimal('1050'))
    expect(scale).to eq('naira')
  ensure
    ENV['MONNIFY_AMOUNT_SCALE'] = original_scale
  end
end
