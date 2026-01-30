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

    it 'returns 422 with stable errors when Anchor service fails' do
      user = create(:user, :tier2)
      Account.create!(user: user, vendor: 'anchor', account_type: :individual, useable_id: 'abc123')
      allow_any_instance_of(AnchorService).to receive(:create_account_number).and_return(
        { status: :bad_request, message: 'anchor_error' }
      )

      get '/api/v1/accounts/get_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['errors']).to include('anchor_error')
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
