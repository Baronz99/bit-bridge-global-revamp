# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin ops summary', type: :request do
  let(:admin) { create(:user, :confirmed, role: 'super_admin') }
  let(:headers) { auth_headers(admin) }

  describe 'GET /api/v1/admin/ops/summary' do
    it 'returns 401 when unauthorized' do
      get '/api/v1/admin/ops/summary'

      expect(response).to have_http_status(:unauthorized)
    end

    it 'returns 403 when non-super-admin' do
      user = create(:user, :confirmed, role: 'support')

      get '/api/v1/admin/ops/summary', headers: auth_headers(user)

      expect(response).to have_http_status(:forbidden)
    end

    it 'returns success payload with expected top-level keys and numeric fields' do
      get '/api/v1/admin/ops/summary', headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)

      expect(body['success']).to eq(true)
      expect(body['data'].keys).to include(
        'generated_at',
        'window_hours',
        'provider_availability',
        'unmatched_credits',
        'bill_orders',
        'webhooks',
        'disputes',
        'transfers_banking'
      )

      data = body['data']

      expect(data['window_hours']).to be_a(Integer)

      expect(data.dig('provider_availability', 'services_summary', 'total_services')).to be_a(Integer)
      expect(data.dig('provider_availability', 'services_summary', 'operational')).to be_a(Integer)
      expect(data.dig('provider_availability', 'services_summary', 'degraded')).to be_a(Integer)
      expect(data.dig('provider_availability', 'services_summary', 'outage')).to be_a(Integer)
      expect(data.dig('provider_availability', 'services_summary', 'unknown')).to be_a(Integer)

      expect(data.dig('unmatched_credits', 'totals_by_status', 'pending')).to be_a(Integer)
      expect(data.dig('unmatched_credits', 'totals_by_status', 'resolved')).to be_a(Integer)
      expect(data.dig('unmatched_credits', 'totals_by_status', 'ignored')).to be_a(Integer)
      expect(data.dig('unmatched_credits', 'totals_by_status', 'total')).to be_a(Integer)
      expect(data.dig('unmatched_credits', 'age_buckets', 'older_than_30m')).to be_a(Integer)
      expect(data.dig('unmatched_credits', 'age_buckets', 'older_than_6h')).to be_a(Integer)
      expect(data.dig('unmatched_credits', 'age_buckets', 'older_than_24h')).to be_a(Integer)

      expect(data.dig('bill_orders', 'stuck_counts', 'initialized', 'older_than_15m')).to be_a(Integer)
      expect(data.dig('bill_orders', 'stuck_counts', 'initialized', 'older_than_30m')).to be_a(Integer)
      expect(data.dig('bill_orders', 'stuck_counts', 'initialized', 'older_than_2h')).to be_a(Integer)
      expect(data.dig('bill_orders', 'stuck_counts', 'pending', 'older_than_15m')).to be_a(Integer)
      expect(data.dig('bill_orders', 'stuck_counts', 'processing', 'older_than_15m')).to be_a(Integer)

      expect(data.dig('webhooks', 'providers', 'buypower', 'received_last_24h')).to be_a(Integer)
      expect(data.dig('webhooks', 'providers', 'anchor', 'received_last_24h')).to be_a(Integer)

      expect(data.dig('disputes', 'open_count')).to be_a(Integer)

      expect(data.dig('transfers_banking', 'anchor_pending_withdrawals', 'count')).to be_a(Integer)
      expect(data.dig('transfers_banking', 'transaction_records', 'total_last_24h')).to be_a(Integer)
      expect(data.dig('transfers_banking', 'transaction_records', 'failed_last_24h')).to be_a(Integer)
      expect(data.dig('transfers_banking', 'transaction_records', 'unknown_status_last_24h')).to be_a(Integer)
    end
  end
end
