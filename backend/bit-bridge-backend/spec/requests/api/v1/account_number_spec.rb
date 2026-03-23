# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Anchor account number', type: :request do
  def build_user(*traits)
    create(:user, *traits, email: "user-#{SecureRandom.hex(6)}@example.com")
  end

  describe 'GET /api/v1/accounts/get_account_number' do
    it 'requires Tier 2 (forbidden when not verified)' do
      user = build_user # not tier2
      get '/api/v1/accounts/get_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:forbidden)
      body = JSON.parse(response.body)
      expect(body['error']).to eq('kyc_required')
      expect(body.dig('flow', 'state')).to eq('blocked_kyc')
    end

    it 'returns 404 when current user has no anchor account' do
      user = build_user(:tier2)
      get '/api/v1/accounts/get_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:not_found)
      body = JSON.parse(response.body)
      expect(body['errors']).to include('No Anchor account present')
      expect(body['error_code']).to eq('anchor_account_missing')
      expect(body.dig('meta', 'flow', 'state')).to eq('not_started')
    end

    it 'returns 404 when another users anchor account exists (scoped to current_user)' do
      other = build_user(:tier2)
      Account.create!(user: other, vendor: 'anchor', account_type: :individual, useable_id: 'abc123')

      user = build_user(:tier2)
      get '/api/v1/accounts/get_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:not_found)
    end

    it 'returns anchor_phone_already_exists code when provider rejects duplicate phone' do
      user = build_user(:tier2)
      Account.create!(user: user, vendor: 'anchor', account_type: :individual, useable_id: 'abc123', status: :completed)
      allow_any_instance_of(AnchorService).to receive(:create_account_number).and_return(
        { status: :bad_request, message: 'PhoneNumber already exist in this organization' }
      )

      get '/api/v1/accounts/get_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['error']).to eq('anchor_phone_already_exists')
      expect(body['error_code']).to eq('anchor_phone_already_exists')
      expect(body['errors'].first).to match(/phone/i)
      expect(body.dig('meta', 'provider')).to eq('anchor')
      expect(body.dig('meta', 'retryable')).to eq(false)
      expect(body.dig('meta', 'flow', 'state')).to eq('blocked_phone_exists')
    end

    it 'returns provider_unavailable code when provider is down' do
      user = build_user(:tier2)
      Account.create!(user: user, vendor: 'anchor', account_type: :individual, useable_id: 'abc123', status: :completed)
      allow_any_instance_of(AnchorService).to receive(:create_account_number).and_return(
        { status: :bad_request, message: '503 Service unavailable', provider_status: 503, provider_body: { error: 'unavailable' } }
      )

      get '/api/v1/accounts/get_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['error']).to eq('provider_unavailable')
      expect(body['error_code']).to eq('provider_unavailable')
      expect(body.dig('meta', 'retryable')).to eq(true)
      expect(body.dig('meta', 'flow', 'state')).to eq('temporary_provider_failure')
    end

    it 'returns anchor_phone_already_exists for alternate phone message' do
      user = build_user(:tier2)
      Account.create!(user: user, vendor: 'anchor', account_type: :individual, useable_id: 'abc123', status: :completed)
      allow_any_instance_of(AnchorService).to receive(:create_account_number).and_return(
        { status: :bad_request, message: 'phone number already attached to customer', provider_status: 400, provider_body: { errors: [{ detail: 'phone number already attached' }] } }
      )

      get '/api/v1/accounts/get_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['error']).to eq('anchor_phone_already_exists')
      expect(body['error_code']).to eq('anchor_phone_already_exists')
      expect(body.dig('meta', 'retryable')).to eq(false)
    end

    it 'returns anchor_account_number_failed with request_id on generic errors' do
      user = build_user(:tier2)
      Account.create!(user: user, vendor: 'anchor', account_type: :individual, useable_id: 'abc123', status: :completed)
      allow_any_instance_of(AnchorService).to receive(:create_account_number).and_return(
        { status: :bad_request, message: 'unknown error' }
      )

      get '/api/v1/accounts/get_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['error']).to eq('anchor_account_number_failed')
      expect(body['error_code']).to eq('anchor_account_number_failed')
      expect(body.dig('meta', 'retryable')).to eq(true)
      expect(body.dig('meta', 'request_id')).to be_present
    end

    it 'fails when provider returns success without account_number' do
      user = build_user(:tier2)
      Account.create!(user: user, vendor: 'anchor', account_type: :individual, useable_id: 'abc123', status: :completed)
      allow_any_instance_of(AnchorService).to receive(:create_account_number).and_return(
        { status: :ok, response: Account.new(account_number: nil), provider_status: 200, provider_body: {} }
      )

      get '/api/v1/accounts/get_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['error']).to eq('anchor_account_number_failed')
      expect(body['error_code']).to eq('anchor_account_number_failed')
      expect(body.dig('meta', 'provider')).to eq('anchor')
      expect(body.dig('meta', 'request_id')).to be_present
      expect(body.dig('meta', 'retryable')).to eq(true)
    end

    it 'passes the Account object via keyword args to AnchorService' do
      user = build_user(:tier2)
      account = Account.create!(user: user, vendor: 'anchor', account_type: :individual, useable_id: 'abc123', status: :completed)

      expect_any_instance_of(AnchorService).to receive(:create_account_number)
        .with(type: account.account_type.to_sym, account: instance_of(Account))
        .and_wrap_original do |m, **kwargs|
          kwargs[:account].update!(account_number: '1234567890')
          { status: :ok, response: kwargs[:account] }
        end

      get '/api/v1/accounts/get_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['message']).to eq('Account created')
      expect(body.dig('flow', 'state')).to eq('provisioned')
    end

    it 'returns 200 when eligible and service succeeds' do
      user = build_user(:tier2)
      Account.create!(user: user, vendor: 'anchor', account_type: :individual, useable_id: 'abc123', status: :completed)
      payload = { 'account_number' => '1234567890' }
      allow_any_instance_of(AnchorService).to receive(:create_account_number).and_wrap_original do |m, **kwargs|
        kwargs[:account].update!(account_number: payload['account_number'])
        { status: :ok, response: kwargs[:account] }
      end

      get '/api/v1/accounts/get_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['data']['account_number']).to eq(payload['account_number'])
      expect(body['message']).to eq('Account created')
      expect(body.dig('flow', 'state')).to eq('provisioned')
    end

    it 'selects canonical anchor account when duplicates exist (prefers provisioned)' do
      user = build_user(:tier2)
      Account.create!(user: user, vendor: 'anchor', account_type: :individual, status: :completed, useable_id: 'dep_pending_1')
      provisioned = Account.create!(
        user: user,
        vendor: 'anchor',
        account_type: :individual,
        status: :completed,
        useable_id: 'dep_live_1',
        account_number: '1234567890'
      )

      expect_any_instance_of(AnchorService).not_to receive(:create_account_number)

      get '/api/v1/accounts/get_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['message']).to eq('Account already provisioned')
      expect(body.dig('data', 'id')).to eq(provisioned.id)
      expect(body.dig('data', 'account_number')).to eq('1234567890')
      expect(body.dig('flow', 'state')).to eq('provisioned')
    end

    it 'returns 202 pending when anchor has accepted create but number is not yet assigned' do
      user = build_user(:tier2)
      account = Account.create!(user: user, vendor: 'anchor', account_type: :individual, status: :completed)
      allow_any_instance_of(AnchorService).to receive(:create_account_number).and_return(
        { status: :accepted, message: 'Anchor account created; account number pending', response: account, provider_status: 202, provider_body: {} }
      )

      get '/api/v1/accounts/get_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:accepted)
      body = JSON.parse(response.body)
      expect(body['message']).to eq('Anchor account created; account number pending')
      expect(body.dig('meta', 'provisioning_pending')).to eq(true)
      expect(body.dig('meta', 'retry_after_seconds')).to eq(5)
      expect(body.dig('flow', 'next_action')).to eq('provision_account_number')
    end
  end

  describe 'POST /api/v1/accounts/provision_account_number' do
    it 'requires Tier 2 (forbidden when not verified)' do
      user = build_user
      post '/api/v1/accounts/provision_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:forbidden)
      body = JSON.parse(response.body)
      expect(body['error']).to eq('kyc_required')
      expect(body.dig('flow', 'state')).to eq('blocked_kyc')
    end

    it 'returns 200 when eligible and service succeeds' do
      user = build_user(:tier2)
      Account.create!(user: user, vendor: 'anchor', account_type: :individual, useable_id: 'abc123', status: :completed)

      allow_any_instance_of(AnchorService).to receive(:create_account_number).and_wrap_original do |_m, **kwargs|
        kwargs[:account].update!(account_number: '1234567890')
        { status: :ok, response: kwargs[:account] }
      end

      post '/api/v1/accounts/provision_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['data']['account_number']).to eq('1234567890')
      expect(body['message']).to eq('Account created')
      expect(body.dig('flow', 'state')).to eq('provisioned')
    end

    it 'returns blocked_kyc when anchor profile exists but kyc is not completed' do
      user = build_user(:tier2)
      Account.create!(user: user, vendor: 'anchor', account_type: :individual, useable_id: 'abc123', status: :unverified)

      post '/api/v1/accounts/provision_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['error']).to eq('anchor_kyc_incomplete')
      expect(body.dig('flow', 'state')).to eq('blocked_kyc')
      expect(body.dig('flow', 'next_action')).to eq('complete_kyc')
    end

    it 'returns kyc_rejected when anchor kyc was rejected by webhook' do
      user = build_user(:tier2)
      account = Account.create!(
        user: user,
        vendor: 'anchor',
        account_type: :individual,
        useable_id: 'abc123',
        account_id: 'anc_customer_rejected_3',
        status: :unverified
      )
      AnchorWebhookEvent.create!(
        event_type: 'customer.identification.rejected',
        reference: account.account_id,
        payload: {
          'attributes' => {
            'failureEventData' => {
              'message' => 'Customer information/BVN Information mismatch'
            }
          }
        },
        status: 'processed',
        received_at: Time.current,
        processed_at: Time.current
      )

      post '/api/v1/accounts/provision_account_number', headers: auth_headers(user)

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['error']).to eq('anchor_kyc_rejected')
      expect(body.dig('flow', 'state')).to eq('kyc_rejected')
      expect(body.dig('flow', 'next_action')).to eq('verify_kyc')
      expect(body.dig('details', 'rejection', 'message')).to eq('Customer information/BVN Information mismatch')
    end

    it 'returns already provisioned when account number already exists and backfills status' do
      user = build_user(:tier2)
      account = Account.create!(
        user: user,
        vendor: 'anchor',
        account_type: :individual,
        useable_id: 'abc123',
        account_number: '1234567890',
        status: :unverified
      )

      post '/api/v1/accounts/provision_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['message']).to eq('Account already provisioned')
      expect(body.dig('flow', 'state')).to eq('provisioned')
      expect(account.reload.status).to eq('completed')
    end

    it 'returns 202 pending and does not create a new deposit account when one is already pending' do
      user = build_user(:tier2)
      account = Account.create!(
        user: user,
        vendor: 'anchor',
        account_type: :individual,
        status: :completed,
        useable_id: 'dep_acc_123-anc_acc'
      )

      allow_any_instance_of(AnchorService).to receive(:sync_anchor_deposit_account!).and_return(account)
      expect_any_instance_of(AnchorService).not_to receive(:create_account_number)

      post '/api/v1/accounts/provision_account_number', headers: auth_headers(user)
      expect(response).to have_http_status(:accepted)
      body = JSON.parse(response.body)
      expect(body['message']).to match(/provisioning is in progress/i)
      expect(body.dig('meta', 'provisioning_pending')).to eq(true)
      expect(body.dig('meta', 'retry_after_seconds')).to eq(5)
      expect(body.dig('flow', 'next_action')).to eq('provision_account_number')
    end
  end
end
