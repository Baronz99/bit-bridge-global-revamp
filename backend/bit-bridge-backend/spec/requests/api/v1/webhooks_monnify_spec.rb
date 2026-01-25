# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Monnify webhook', type: :request do
  def post_webhook(payload)
    post '/api/v1/monnify/webhook',
         params: payload.to_json,
         headers: { 'CONTENT_TYPE' => 'application/json' }
  end

  it 'does not create duplicate deposits for repeated references' do
    user = create(:user)
    user.ngn_wallet

    payload = {
      eventType: 'SUCCESSFUL_TRANSACTION',
      eventData: {
        paymentStatus: 'PAID',
        paymentReference: 'mon-123',
        transactionReference: 'tx-123',
        currencyCode: 'NGN',
        product: { reference: user.id },
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
    }

    expect do
      post_webhook(payload)
    end.to change(Transaction, :count).by(1)
      .and change(TransactionRecord, :count).by(1)

    expect(response).to have_http_status(:ok)

    expect do
      post_webhook(payload)
    end.not_to change(Transaction, :count)

    expect(response).to have_http_status(:ok)
  end

  it 'normalizes monnify kobo amounts' do
    controller = Api::V1::WebhooksController.new
    original_scale = ENV['MONNIFY_AMOUNT_SCALE']
    ENV['MONNIFY_AMOUNT_SCALE'] = 'kobo'

    amount, scale = controller.send(:normalize_monnify_amount, '1050', 'NGN')

    expect(amount).to eq(BigDecimal('10.50'))
    expect(scale).to eq('kobo')
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
