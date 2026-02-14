# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Service availability', type: :request do
  let(:user) { create(:user, :confirmed) }
  let(:headers) { auth_headers(user) }

  describe 'GET /api/v1/service_availability' do
    it 'requires authentication' do
      get '/api/v1/service_availability'

      expect(response).to have_http_status(:unauthorized)
    end

    it 'returns unknown-first payload when there is no recent signal' do
      get '/api/v1/service_availability', headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['success']).to eq(true)
      expect(body.dig('data', 'global', 'state')).to eq('unknown')
      expect(body.dig('data', 'services')).to eq([])
    end

    it 'uses fresh persisted provider status when available' do
      now = Time.current
      ProviderServiceStatus.create!(
        provider: 'buypower',
        service_key: 'MTN_VTU',
        state: 'down',
        reliability_percent: 41,
        sample_size: 23,
        window_started_at: now - 30.minutes,
        window_ended_at: now,
        avg_latency_ms: 5200,
        updated_at: now,
        created_at: now
      )

      get '/api/v1/service_availability', headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      service = body.dig('data', 'services').find { |row| row['key'] == 'MTN_VTU' }

      expect(service).to be_present
      expect(service['state']).to eq('outage')
      expect(service['reliability_percent']).to eq(41)
      expect(service.dig('source', 'provider_signal')).to eq('down')
      expect(service.dig('source', 'internal_signal')).to eq('outage')
    end

    it 'marks a service outage only with sufficient confidence' do
      now = Time.current
      20.times do |idx|
        BillOrder.create!(
          user: user,
          amount: 200,
          total_amount: 200,
          biller: 'MTN',
          service_type: 'VTU',
          status: :failed,
          reason: 'An unexpected error occured.',
          created_at: now - (idx + 120).seconds,
          updated_at: now - (idx + 60).seconds
        )
      end

      get '/api/v1/service_availability', headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      service = body.dig('data', 'services').find { |row| row['key'] == 'MTN_VTU' }

      expect(service).to be_present
      expect(service['state']).to eq('outage')
      expect(service['confidence']).to eq('high')
      expect(service.dig('advice', 'can_checkout')).to eq(false)
    end
  end
end