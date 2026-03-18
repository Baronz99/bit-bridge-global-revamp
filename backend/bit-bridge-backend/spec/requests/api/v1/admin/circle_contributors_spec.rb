# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Admin circle contributors', type: :request do
  let(:admin) { create(:user, :confirmed, role: 'admin', admin_role: 'support', email: "admin-#{SecureRandom.hex(4)}@example.com") }
  let(:headers) { auth_headers(admin) }

  describe 'GET /api/v1/admin/circles/:id/contributors' do
    it 'returns 401 when unauthorized' do
      circle = Circle.create!(
        owner: create(:user, :confirmed, email: "founders-owner-#{SecureRandom.hex(4)}@example.com"),
        name: 'Founders Circle'
      )

      get "/api/v1/admin/circles/#{circle.id}/contributors"

      expect(response).to have_http_status(:unauthorized)
    end

    it 'returns 403 when non-admin' do
      user = create(:user, :confirmed, role: 'client', email: "non-admin-#{SecureRandom.hex(4)}@example.com")
      circle = Circle.create!(
        owner: create(:user, :confirmed, email: "founders-owner-#{SecureRandom.hex(4)}@example.com"),
        name: 'Founders Circle'
      )

      get "/api/v1/admin/circles/#{circle.id}/contributors", headers: auth_headers(user)

      expect(response).to have_http_status(:forbidden)
    end

    it 'returns aggregated contributors for circle fund credits only' do
      owner = create(:user, :confirmed, role: 'admin', admin_role: 'support', email: "owner-#{SecureRandom.hex(4)}@example.com")
      circle = Circle.create!(
        owner: owner,
        name: 'BitBridge Founders Circle',
        circle_type: 'official',
        badge_label: 'Founders Circle'
      )
      CircleMembership.create!(circle: circle, user: owner, role: :admin)

      contributor_one = create(:user, :confirmed, email: 'founder-one@example.com')
      contributor_one.create_user_profile!(first_name: 'Ada', last_name: 'Bridge')
      CircleMembership.create!(circle: circle, user: contributor_one, role: :member, username: 'adabridge')

      contributor_two = create(:user, :confirmed, email: 'founder-two@example.com')
      contributor_two.create_user_profile!(first_name: 'Tobi', last_name: 'Stone')
      CircleMembership.create!(circle: circle, user: contributor_two, role: :member)

      CircleTransaction.create!(circle: circle, user: contributor_one, amount_cents: 3_000, direction: :credit, kind: 'fund')
      CircleTransaction.create!(circle: circle, user: contributor_one, amount_cents: 2_000, direction: :credit, kind: 'fund')
      CircleTransaction.create!(circle: circle, user: contributor_one, amount_cents: 1_000, direction: :debit, kind: 'payout')
      CircleTransaction.create!(circle: circle, user: contributor_two, amount_cents: 4_000, direction: :credit, kind: 'fund')
      CircleTransaction.create!(circle: circle, user: contributor_two, amount_cents: 700, direction: :credit, kind: 'manual_adjustment')

      get "/api/v1/admin/circles/#{circle.id}/contributors", headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)

      expect(body.dig('data', 'circle')).to include(
        'id' => circle.id,
        'name' => 'BitBridge Founders Circle',
        'circle_type' => 'official',
        'badge_label' => 'Founders Circle'
      )
      expect(body.dig('data', 'contributors_count')).to eq(2)

      contributors = body.dig('data', 'contributors')
      expect(contributors.map { |row| row['user_id'] }).to eq([contributor_one.id, contributor_two.id])

      first = contributors.first
      expect(first).to include(
        'user_id' => contributor_one.id,
        'username' => 'adabridge',
        'display_name' => 'adabridge',
        'email' => 'founder-one@example.com',
        'total_contributed_cents' => 5_000,
        'contribution_count' => 2
      )
      expect(first['first_contributed_at']).to be_present
      expect(first['last_contributed_at']).to be_present

      second = contributors.second
      expect(second).to include(
        'user_id' => contributor_two.id,
        'username' => 'tobi_stone',
        'display_name' => 'tobi_stone',
        'email' => 'founder-two@example.com',
        'total_contributed_cents' => 4_000,
        'contribution_count' => 1
      )
    end

    it 'creates an admin audit event for the report request' do
      circle = Circle.create!(
        owner: admin,
        name: 'BitBridge Founders Circle',
        circle_type: 'official'
      )
      CircleMembership.create!(circle: circle, user: admin, role: :admin)

      expect do
        get "/api/v1/admin/circles/#{circle.id}/contributors", headers: headers
      end.to change(AdminAuditEvent, :count).by(1)

      event = AdminAuditEvent.order(created_at: :desc).first
      expect(event.action).to eq('admin.circle_contributors.list')
      expect(event.admin_user_id).to eq(admin.id)
      expect(event.metadata).to include('circle_id' => circle.id, 'contributor_count' => 0)
      expect(event.metadata['request_id']).to be_present
    end
  end
end
