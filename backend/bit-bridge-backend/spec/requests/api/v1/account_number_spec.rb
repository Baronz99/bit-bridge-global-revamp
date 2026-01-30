# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Anchor account number', type: :request do
  describe 'GET /api/v1/accounts/get_account_number' do
    it 'requires Tier 2 (forbidden when not verified)' do
      user = create(:user) # not tier2
      get '/api/v1/accounts/get_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:forbidden)
      body = JSON.parse(response.body)
      expect(body['error']).to eq('kyc_required')
    end

    it 'returns 404 when current user has no anchor account' do
      user = create(:user, :tier2)
      get '/api/v1/accounts/get_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:not_found)
      body = JSON.parse(response.body)
      expect(body['errors']).to include('No Anchor account present')
    end

    it 'returns 404 when another users anchor account exists (scoped to current_user)' do
      other = create(:user, :tier2)
      Account.create!(user: other, vendor: 'anchor', account_type: :individual, useable_id: 'abc123')

      user = create(:user, :tier2)
      get '/api/v1/accounts/get_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:not_found)
    end

    it 'returns anchor_phone_already_exists code when provider rejects duplicate phone' do
      user = create(:user, :tier2)
      Account.create!(user: user, vendor: 'anchor', account_type: :individual, useable_id: 'abc123')
      allow_any_instance_of(AnchorService).to receive(:create_account_number).and_return(
        { status: :bad_request, message: 'PhoneNumber already exist in this organization' }
      )

      get '/api/v1/accounts/get_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['error']).to eq('anchor_phone_already_exists')
      expect(body['errors'].first).to match(/phone/i)
      expect(body.dig('meta', 'provider')).to eq('anchor')
      expect(body.dig('meta', 'retryable')).to eq(false)
    end

    it 'returns provider_unavailable code when provider is down' do
      user = create(:user, :tier2)
      Account.create!(user: user, vendor: 'anchor', account_type: :individual, useable_id: 'abc123')
      allow_any_instance_of(AnchorService).to receive(:create_account_number).and_return(
        { status: :bad_request, message: '503 Service unavailable', provider_status: 503, provider_body: { error: 'unavailable' } }
      )

      get '/api/v1/accounts/get_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['error']).to eq('provider_unavailable')
      expect(body.dig('meta', 'retryable')).to eq(true)
    end

    it 'returns anchor_phone_already_exists for alternate phone message' do
      user = create(:user, :tier2)
      Account.create!(user: user, vendor: 'anchor', account_type: :individual, useable_id: 'abc123')
      allow_any_instance_of(AnchorService).to receive(:create_account_number).and_return(
        { status: :bad_request, message: 'phone number already attached to customer', provider_status: 400, provider_body: { errors: [{ detail: 'phone number already attached' }] } }
      )

      get '/api/v1/accounts/get_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['error']).to eq('anchor_phone_already_exists')
      expect(body.dig('meta', 'retryable')).to eq(false)
    end

    it 'returns anchor_account_number_failed with request_id on generic errors' do
      user = create(:user, :tier2)
      Account.create!(user: user, vendor: 'anchor', account_type: :individual, useable_id: 'abc123')
      allow_any_instance_of(AnchorService).to receive(:create_account_number).and_return(
        { status: :bad_request, message: 'unknown error' }
      )

      get '/api/v1/accounts/get_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['error']).to eq('anchor_account_number_failed')
      expect(body.dig('meta', 'retryable')).to eq(true)
      expect(body.dig('meta', 'request_id')).to be_present
    end

    it 'passes the Account object via keyword args to AnchorService' do
      user = create(:user, :tier2)
      account = Account.create!(user: user, vendor: 'anchor', account_type: :individual, useable_id: 'abc123')

      expect_any_instance_of(AnchorService).to receive(:create_account_number)
        .with(type: account.account_type.to_sym, account: instance_of(Account))
        .and_return({ status: :ok, response: { 'account_number' => '1234567890' } })

      get '/api/v1/accounts/get_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:ok)
    end

    it 'returns 200 when eligible and service succeeds' do
      user = create(:user, :tier2)
      Account.create!(user: user, vendor: 'anchor', account_type: :individual, useable_id: 'abc123')
      payload = { 'account_number' => '1234567890' }
      allow_any_instance_of(AnchorService).to receive(:create_account_number).and_return(
        { status: :ok, response: payload }
      )

      get '/api/v1/accounts/get_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['data']).to eq(payload)
    end
  end
end
