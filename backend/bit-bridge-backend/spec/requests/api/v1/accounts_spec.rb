# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Accounts', type: :request do
  def build_user(*traits)
    create(:user, *traits, email: "user-#{SecureRandom.hex(6)}@example.com")
  end

  describe 'POST /api/v1/accounts' do
    it 'returns 422 and does not call AnchorService when address is missing' do
      user = build_user(:tier2)
      UserProfile.create!(
        user: user,
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone_number: '08000000000',
        city: 'Lagos',
        state: 'LA',
        postal_code: '100001',
        bvn: '12345678901',
        date_of_birth: Date.new(1990, 1, 1)
      )

      anchor_service = instance_double(AnchorService)
      allow(AnchorService).to receive(:new).and_return(anchor_service)
      allow(anchor_service).to receive(:create_individual_account)

      post '/api/v1/accounts',
           params: { account: { vendor: 'anchor' } },
           headers: auth_headers(user)

      expect(anchor_service).not_to have_received(:create_individual_account)
      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body['success']).to eq(false)
      expect(body.fetch('message')).to eq('Complete your profile to create an Anchor account.')
      expect(body.fetch('error_code')).to eq('ANCHOR_ONBOARDING_INCOMPLETE')
      expect(body.fetch('missing_fields')).to include('address.addressLine_1')
      expect(body.dig('flow', 'state')).to eq('blocked_profile_incomplete')
      expect(body.dig('flow', 'next_action')).to eq('complete_profile')
      expect(body['request_id']).to be_present
    end

    it 'returns 409 with ANCHOR_PHONE_EXISTS when phone already exists' do
      user = build_user(:tier2)
      UserProfile.create!(
        user: user,
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone_number: '08000000000',
        address_line1: 'Profile Street',
        city: 'Lagos',
        state: 'LA',
        postal_code: '100001',
        bvn: '12345678901',
        date_of_birth: Date.new(1990, 1, 1)
      )

      anchor_service = instance_double(AnchorService)
      allow(AnchorService).to receive(:new).and_return(anchor_service)
      allow(anchor_service).to receive(:create_individual_account).and_return(
        status: :bad_request,
        message: 'Customer with PhoneNumber already exist in this Organization.'
      )

      post '/api/v1/accounts',
           params: { account: { vendor: 'anchor' } },
           headers: auth_headers(user)

      expect(response).to have_http_status(:conflict)
      body = JSON.parse(response.body)
      expect(body['success']).to eq(false)
      expect(body.fetch('message')).to eq('This phone number already exists in Anchor Sandbox.')
      expect(body.fetch('error_code')).to eq('ANCHOR_PHONE_EXISTS')
      expect(body.dig('flow', 'state')).to eq('blocked_phone_exists')
    end

    it 'passes profile address_line1 to AnchorService when present' do
      user = build_user(:tier2)
      UserProfile.create!(
        user: user,
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone_number: '08000000000',
        address_line1: '42 Profile Street',
        city: 'Lagos',
        state: 'LA',
        postal_code: '100001',
        bvn: '12345678901',
        date_of_birth: Date.new(1990, 1, 1)
      )

      anchor_service = instance_double(AnchorService)
      allow(AnchorService).to receive(:new).and_return(anchor_service)
      allow(anchor_service).to receive(:create_individual_account).and_return(
        status: :ok,
        response: {}
      )

      post '/api/v1/accounts',
           params: { account: { vendor: 'anchor' } },
           headers: auth_headers(user)

      expect(anchor_service).to have_received(:create_individual_account).with(
        hash_including(address: '42 Profile Street')
      )
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['success']).to eq(true)
      expect(body.dig('flow', 'state')).to eq('customer_created_no_deposit_account')
      expect(body.dig('flow', 'next_action')).to eq('provision_account_number')
    end
  end
end
