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
        useable_id: nil,
        status: :completed
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

    it 'returns blocked_kyc flow when profile exists but kyc is incomplete' do
      user = build_user(:tier2)
      Account.create!(
        user: user,
        vendor: 'anchor',
        account_type: :individual,
        account_id: 'anc_customer_2',
        status: :unverified
      )

      allow_any_instance_of(AnchorService).to receive(:fetch_account_detail).and_return(
        { status: :bad_request, message: 'No Account found with Id: anc_customer_2' }
      )

      get '/api/v1/accounts/get_user_account_detail', headers: auth_headers(user)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.dig('flow', 'state')).to eq('blocked_kyc')
      expect(body.dig('flow', 'next_action')).to eq('verify_kyc')
    end

    it 'marks anchor kyc as rejected when customer detail reports rejected verification' do
      user = build_user(:tier2)
      account = Account.create!(
        user: user,
        vendor: 'anchor',
        account_type: :individual,
        account_id: 'anc_customer_rejected_1',
        status: :verifying
      )

      allow_any_instance_of(AnchorService).to receive(:fetch_customer_detail).and_return(
        {
          status: :ok,
          data: {
            'id' => account.account_id,
            'type' => 'IndividualCustomer',
            'attributes' => {
              'status' => 'ACTIVE',
              'verification' => {
                'status' => 'rejected',
                'details' => [
                  {
                    'comment' => 'Customer information/BVN Information mismatch',
                    'validatedItems' => [
                      { 'item' => 'FULL_NAME', 'status' => 'REJECTED' },
                      { 'item' => 'PHONE_NUMBER', 'status' => 'REJECTED' }
                    ]
                  }
                ]
              }
            }
          }
        }
      )
      allow_any_instance_of(AnchorService).to receive(:fetch_account_detail).and_return(
        { status: :bad_request, message: 'No Account found with Id: anc_customer_rejected_1' }
      )

      get '/api/v1/accounts/get_user_account_detail', headers: auth_headers(user)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.dig('flow', 'state')).to eq('kyc_rejected')
      expect(body.dig('flow', 'next_action')).to eq('verify_kyc')
      expect(account.reload.status).to eq('unverified')
      event = AnchorWebhookEvent.find_by(event_type: 'customer.identification.rejected', reference: account.account_id)
      expect(event).to be_present
      expect(event.payload.dig('attributes', 'failureEventData', 'message')).to eq('Customer information/BVN Information mismatch')
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

    it 'backfills status to completed when account number already exists' do
      user = build_user(:tier2)
      account = Account.create!(
        user: user,
        vendor: 'anchor',
        account_type: :individual,
        account_number: '1234567890',
        status: :unverified
      )

      get '/api/v1/accounts/anchor_onboarding_state', headers: auth_headers(user)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.dig('data', 'kyc_status')).to eq('completed')
      expect(body.dig('flow', 'state')).to eq('provisioned')
      expect(account.reload.status).to eq('completed')
    end

    it 'returns kyc_rejected flow and rejection details when anchor rejection webhook exists' do
      user = build_user(:tier2)
      account = Account.create!(
        user: user,
        vendor: 'anchor',
        account_type: :individual,
        account_id: 'anc_customer_rejected_2',
        status: :unverified
      )
      AnchorWebhookEvent.create!(
        event_type: 'customer.identification.rejected',
        reference: account.account_id,
        payload: {
          'attributes' => {
            'failureEventData' => {
              'message' => 'Customer information/BVN Information mismatch',
              'validationResult' => [
                { 'validationType' => 'FULL_NAME', 'reason' => 'REJECTED' }
              ]
            }
          }
        },
        status: 'processed',
        received_at: Time.current,
        processed_at: Time.current
      )

      get '/api/v1/accounts/anchor_onboarding_state', headers: auth_headers(user)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.dig('flow', 'state')).to eq('kyc_rejected')
      expect(body.dig('flow', 'next_action')).to eq('verify_kyc')
      expect(body.dig('data', 'kyc_rejection', 'message')).to eq('Customer information/BVN Information mismatch')
    end

    it 'returns temporary_provider_failure when latest anchor kyc event is provider error' do
      user = build_user(:tier2)
      account = Account.create!(
        user: user,
        vendor: 'anchor',
        account_type: :individual,
        account_id: 'anc_customer_error_1',
        status: :unverified
      )
      AnchorWebhookEvent.create!(
        event_type: 'customer.identification.error',
        reference: account.account_id,
        payload: {
          'attributes' => {
            'failureEventData' => {
              'message' => 'Provider timeout'
            }
          }
        },
        status: 'processed',
        received_at: Time.current,
        processed_at: Time.current
      )

      get '/api/v1/accounts/anchor_onboarding_state', headers: auth_headers(user)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.dig('flow', 'state')).to eq('temporary_provider_failure')
      expect(body.dig('flow', 'next_action')).to eq('verify_kyc')
    end

    it 'returns blocked_kyc when latest anchor kyc event requires more information' do
      user = build_user(:tier2)
      account = Account.create!(
        user: user,
        vendor: 'anchor',
        account_type: :individual,
        account_id: 'anc_customer_more_info_1',
        status: :unverified
      )
      AnchorWebhookEvent.create!(
        event_type: 'customer.identification.reenter_information',
        reference: account.account_id,
        payload: {
          'attributes' => {
            'failureEventData' => {
              'message' => 'Update customer information and retry'
            }
          }
        },
        status: 'processed',
        received_at: Time.current,
        processed_at: Time.current
      )

      get '/api/v1/accounts/anchor_onboarding_state', headers: auth_headers(user)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.dig('flow', 'state')).to eq('blocked_kyc')
      expect(body.dig('flow', 'next_action')).to eq('verify_kyc')
    end
  end
end
