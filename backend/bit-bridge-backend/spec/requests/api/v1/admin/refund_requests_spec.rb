# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin refund requests', type: :request do
  let(:admin) { create(:user, :confirmed, role: 'super_admin') }
  let(:headers) { auth_headers(admin) }

  describe 'GET /api/v1/admin/refund_requests' do
    it 'returns 401 when unauthorized' do
      get '/api/v1/admin/refund_requests'

      expect(response).to have_http_status(:unauthorized)
    end

    it 'returns 403 when non-admin' do
      user = create(:user, :confirmed, role: 'client')

      get '/api/v1/admin/refund_requests', headers: auth_headers(user)

      expect(response).to have_http_status(:forbidden)
    end

    it 'supports status and reference filters' do
      RefundRequest.create!(
        transaction_reference: 'txn-001',
        reason: 'late delivery',
        status: :received,
        requested_at: 2.hours.ago
      )
      RefundRequest.create!(
        transaction_reference: 'abc-002',
        reason: 'failed vend',
        status: :investigating,
        requested_at: 1.hour.ago
      )

      get '/api/v1/admin/refund_requests',
          params: { status: 'received', reference: 'txn' },
          headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['data'].size).to eq(1)
      expect(body['data'].first['transaction_reference']).to eq('txn-001')
    end
  end

  describe 'POST /api/v1/admin/refund_requests' do
    it 'creates a refund request' do
      post '/api/v1/admin/refund_requests',
           params: {
             refund_request: {
               transaction_reference: 'txn-create-001',
               provider: 'buypower',
               reason: 'token not delivered',
               status: 'received',
               notes: 'customer called support'
             }
           },
           headers: headers

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body['success']).to eq(true)
      expect(body.dig('data', 'transaction_reference')).to eq('txn-create-001')
      expect(body.dig('data', 'status')).to eq('received')
      expect(body.dig('data', 'handled_by_admin_id')).to eq(admin.id)
    end
  end

  describe 'PATCH /api/v1/admin/refund_requests/:id' do
    it 'updates status with valid transition' do
      refund_request = RefundRequest.create!(
        transaction_reference: 'txn-update-001',
        reason: 'pending too long',
        status: :received,
        requested_at: 3.hours.ago
      )

      patch "/api/v1/admin/refund_requests/#{refund_request.id}",
            params: { refund_request: { status: 'investigating', notes: 'triaging now', acknowledged: true } },
            headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['success']).to eq(true)
      expect(body.dig('data', 'status')).to eq('investigating')
      expect(body.dig('data', 'acknowledged_at')).to be_present
    end

    it 'rejects invalid status transition' do
      refund_request = RefundRequest.create!(
        transaction_reference: 'txn-update-002',
        reason: 'wrong amount',
        status: :received,
        requested_at: 2.hours.ago
      )

      patch "/api/v1/admin/refund_requests/#{refund_request.id}",
            params: { refund_request: { status: 'refunded' } },
            headers: headers

      expect(response).to have_http_status(:ok)

      patch "/api/v1/admin/refund_requests/#{refund_request.id}",
            params: { refund_request: { status: 'approved' } },
            headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['success']).to eq(false)
      expect(body['message']).to include('invalid transition')
    end
  end
end
