# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Anchor account detail flow', type: :request do
  def build_user(*traits)
    create(:user, *traits, email: "user-#{SecureRandom.hex(6)}@example.com")
  end

  describe 'GET /api/v1/accounts/get_user_account_detail' do
    it 'returns not_started flow when user has no anchor account' do
      user = build_user(:tier2)

      get '/api/v1/accounts/get_user_account_detail', headers: auth_headers(user)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['success']).to eq(true)
      expect(body['has_anchor_account']).to eq(false)
      expect(body.dig('flow', 'state')).to eq('not_started')
      expect(body.dig('flow', 'next_action')).to eq('create_anchor_account')
    end

    it 'returns customer_created_no_deposit_account flow when provider has no deposit account yet' do
      user = build_user(:tier2)
      Account.create!(
        user: user,
        vendor: 'anchor',
        account_type: :individual,
        account_id: 'anc_customer_1',
        useable_id: nil
      )

      allow_any_instance_of(AnchorService).to receive(:fetch_account_detail).and_return(
        { status: :bad_request, message: 'No Account found with Id: anc_customer_1' }
      )

      get '/api/v1/accounts/get_user_account_detail', headers: auth_headers(user)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['success']).to eq(true)
      expect(body['has_anchor_account']).to eq(true)
      expect(body['message']).to eq('No deposit account yet')
      expect(body.dig('flow', 'state')).to eq('customer_created_no_deposit_account')
      expect(body.dig('flow', 'next_action')).to eq('provision_account_number')
    end
  end

  describe 'GET /api/v1/accounts/anchor_onboarding_state' do
    it 'returns canonical not_started state when user has no anchor account' do
      user = build_user(:tier2)

      get '/api/v1/accounts/anchor_onboarding_state', headers: auth_headers(user)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['success']).to eq(true)
      expect(body['has_anchor_account']).to eq(false)
      expect(body['has_deposit_account']).to eq(false)
      expect(body.dig('flow', 'state')).to eq('not_started')
      expect(body.dig('flow', 'next_action')).to eq('create_anchor_account')
      expect(body['request_id']).to be_present
      expect(body.dig('capabilities', 'can_create_anchor_profile')).to eq(true)
    end
  end
end
