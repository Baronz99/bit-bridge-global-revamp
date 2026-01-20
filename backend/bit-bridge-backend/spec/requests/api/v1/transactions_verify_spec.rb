# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Transactions verify', type: :request do
  describe 'GET /api/v1/transactions/verify' do
    it 'returns 400 for invalid reference format' do
      get '/api/v1/transactions/verify', params: { payment_reference: 'bad-ref' }

      expect(response).to have_http_status(:bad_request)
    end

    it 'returns safe fields for a matching transaction record' do
      user = create(:user)
      wallet = user.ngn_wallet
      transaction = Transaction.create!(
        wallet: wallet,
        amount: 1000,
        transaction_type: :deposit,
        status: :approved,
        coin_type: :bank
      )
      record = TransactionRecord.create!(
        exchange: transaction,
        reference: 'fbg-123',
        status: 'Approved',
        amount: 1000
      )

      get '/api/v1/transactions/verify', params: { payment_reference: record.reference }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['data'].keys).to contain_exactly(
        'reference',
        'status',
        'amount',
        'currency',
        'created_at',
        'updated_at'
      )
      expect(body['data']['reference']).to eq('fbg-123')
      expect(body['data']['status']).to eq('approved')
    end

    it 'returns 404 when no record is found' do
      get '/api/v1/transactions/verify', params: { payment_reference: 'fbg-999999' }

      expect(response).to have_http_status(:not_found)
    end
  end
end
