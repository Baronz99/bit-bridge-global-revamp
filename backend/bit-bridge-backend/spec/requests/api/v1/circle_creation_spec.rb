# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Circle creation', type: :request do
  describe 'POST /api/v1/circles' do
    let(:user) do
      create(:user, :confirmed, :tier2, email: "circle-user-#{SecureRandom.hex(6)}@example.com")
    end
    let(:admin) do
      create(
        :user,
        :confirmed,
        :tier2,
        email: "circle-admin-#{SecureRandom.hex(6)}@example.com",
        role: 'admin',
        admin_role: 'support'
      )
    end

    it 'allows a normal authenticated user to create a standard circle' do
      post '/api/v1/circles',
           params: {
             circle: {
               name: 'Rent Circle',
               purpose: 'Monthly rent',
               description: 'Household rent payments'
             }
           },
           headers: auth_headers(user)

      expect(response).to have_http_status(:created)
      expect(response.parsed_body).to include(
        'name' => 'Rent Circle',
        'purpose' => 'Monthly rent',
        'description' => 'Household rent payments',
        'circle_type' => 'standard'
      )

      circle = Circle.order(:created_at).last
      expect(circle.owner).to eq(user)
      expect(circle.circle_type).to eq('standard')
      expect(circle.circle_memberships.find_by(user: user)&.role).to eq('admin')
    end

    it 'forbids a normal authenticated user from creating an official circle' do
      expect do
        post '/api/v1/circles',
             params: {
               circle: {
                 name: 'Founders Circle',
                 purpose: 'Internal founders group',
                 description: 'Official founders community',
                 circle_type: 'official'
               }
             },
             headers: auth_headers(user)
      end.not_to change(Circle, :count)

      expect(response).to have_http_status(:forbidden)
      expect(response.parsed_body).to eq(
        'error' => 'not_authorized',
        'message' => 'Only BitBridge admins can create official circles'
      )
    end

    it 'allows an admin to create an official circle' do
      post '/api/v1/circles',
           params: {
             circle: {
               name: 'BitBridge Founders Circle',
               purpose: 'Founders community',
               description: 'Official founders circle',
               circle_type: 'official'
             }
           },
           headers: auth_headers(admin)

      expect(response).to have_http_status(:created)
      expect(response.parsed_body).to include(
        'name' => 'BitBridge Founders Circle',
        'circle_type' => 'official'
      )

      circle = Circle.order(:created_at).last
      expect(circle.owner).to eq(admin)
      expect(circle.circle_type).to eq('official')
    end

    it 'forces non-admin creation payloads to standard when no official type is requested' do
      post '/api/v1/circles',
           params: {
             circle: {
               name: 'Trip Circle',
               purpose: 'Vacation',
               description: 'Friends trip',
               circle_type: 'standard'
             }
           },
           headers: auth_headers(user)

      expect(response).to have_http_status(:created)
      expect(response.parsed_body['circle_type']).to eq('standard')
      expect(Circle.order(:created_at).last.circle_type).to eq('standard')
    end
  end
end
