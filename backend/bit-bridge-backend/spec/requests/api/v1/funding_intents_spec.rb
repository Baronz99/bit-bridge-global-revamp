# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Funding intents', type: :request do
  let(:user) { create(:user, :confirmed, email: 'funding-intents-spec@example.com') }
  let(:headers) { auth_headers(user) }

  before do
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with('ANCHOR_POOLED_BANK').and_return('Anchor Bank')
    allow(ENV).to receive(:[]).with('ANCHOR_POOLED_ACCOUNT_NAME').and_return('BitBridge Global')
    allow(ENV).to receive(:[]).with('ANCHOR_POOLED_ACCOUNT_NUMBER').and_return('1234567890')
  end

  describe 'POST /api/v1/funding/intents' do
    it 'creates a pending funding intent with pooled account details' do
      post '/api/v1/funding/intents',
           params: { amount_cents: 250_000, provider: 'anchor' },
           headers: headers

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      data = body.fetch('data')

      expect(data['provider']).to eq('anchor')
      expect(data['status']).to eq('pending')
      expect(data['expected_amount_cents']).to eq(250_000)
      expect(data['reference']).to match(/\ABBG-[A-Z0-9]{6}-[A-Z0-9]{4}\z/)
      expect(data.dig('account', 'bank_name')).to eq('Anchor Bank')
      expect(data.dig('account', 'account_number')).to eq('1234567890')
      expect(FundingIntent.find(data['id']).user_id).to eq(user.id)
    end

    it 'blocks restricted users from creating funding intents' do
      user.create_user_risk_control!(monitoring_enabled: true, restricted: true, restriction_reason: 'review')

      post '/api/v1/funding/intents',
           params: { amount_cents: 25_000, provider: 'anchor' },
           headers: headers

      expect(response).to have_http_status(:forbidden)
      expect(JSON.parse(response.body)).to eq(
        'error' => 'account_restricted',
        'message' => 'Account is temporarily restricted pending review.'
      )
    end

    it 'auto restricts monitored users when a requested funding amount exceeds the configured single transaction limit' do
      user.create_user_risk_control!(monitoring_enabled: true, auto_lock_enabled: true, single_txn_limit_cents: 20_000)

      post '/api/v1/funding/intents',
           params: { amount_cents: 25_000, provider: 'anchor' },
           headers: headers

      expect(response).to have_http_status(:forbidden)
      expect(JSON.parse(response.body)).to eq(
        'error' => 'risk_review_required',
        'message' => 'This account has been placed under review due to configured risk limits.'
      )
      expect(user.reload.user_risk_control.restricted).to eq(true)
      expect(user.risk_events.last&.trigger_type).to eq('single_txn_limit_exceeded')
    end
  end

  describe 'GET /api/v1/funding/intents/:id' do
    it 'returns the intent for the authenticated user' do
      intent = FundingIntent.create!(
        user: user,
        provider: 'anchor',
        reference: 'BBG-ABC123-1XYZ',
        expected_amount_cents: 100_000,
        expires_at: 30.minutes.from_now,
        status: 'pending',
        metadata: {}
      )

      get "/api/v1/funding/intents/#{intent.id}", headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      data = body.fetch('data')

      expect(data['id']).to eq(intent.id)
      expect(data['reference']).to eq('BBG-ABC123-1XYZ')
      expect(data['status']).to eq('pending')
      expect(data.dig('account', 'account_name')).to eq('BitBridge Global')
    end
  end
end
