# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Funding intents', type: :request do
  let(:user) { create(:user, :confirmed) }
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
