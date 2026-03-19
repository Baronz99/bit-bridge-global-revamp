# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Admin::RiskControls', type: :request do
  let(:compliance_admin) do
    create(:user, :confirmed, email: 'risk-index-compliance@example.com', role: 'admin', admin_role: 'compliance', admin_auth_time: Time.current)
  end
  let(:support_admin) do
    create(:user, :confirmed, email: 'risk-index-support@example.com', role: 'admin', admin_role: 'support', admin_auth_time: Time.current)
  end
  let(:monitored_user) { create(:user, :confirmed, email: 'monitored-risk@example.com', kyc_level: 'tier_1') }
  let(:restricted_user) { create(:user, :confirmed, email: 'restricted-risk@example.com', kyc_level: 'tier_2') }

  before do
    monitored_user.create_user_profile!(first_name: 'Monitored', last_name: 'User', phone_number: '08000000001')
    restricted_user.create_user_profile!(first_name: 'Restricted', last_name: 'User', phone_number: '08000000002')

    monitored_user.create_user_risk_control!(
      monitoring_enabled: true,
      auto_lock_enabled: true,
      single_txn_limit_cents: 100_000
    )
    restricted_user.create_user_risk_control!(
      monitoring_enabled: true,
      restricted: true,
      restriction_reason: 'manual review'
    )

    restricted_user.risk_events.create!(
      trigger_type: 'manual_restriction',
      amount_cents: 250_000,
      threshold_cents: 100_000,
      action_taken: 'restricted',
      source_type: 'UserRiskControl',
      metadata: { reason: 'manual review' }
    )
  end

  it 'returns the monitored and restricted queue for authorized admins' do
    get '/api/v1/admin/risk_controls', headers: auth_headers(compliance_admin)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body.dig('summary', 'monitored')).to eq(2)
    expect(body.dig('summary', 'restricted')).to eq(1)

    restricted_row = body.fetch('data').find { |item| item['user_id'] == restricted_user.id }
    expect(restricted_row['restricted']).to eq(true)
    expect(restricted_row['risk_events_count']).to eq(1)
    expect(restricted_row.dig('latest_risk_event', 'action_taken')).to eq('restricted')
  end

  it 'filters restricted accounts only' do
    get '/api/v1/admin/risk_controls',
        params: { status: 'restricted' },
        headers: auth_headers(compliance_admin)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body.fetch('data').length).to eq(1)
    expect(body.fetch('data').first['user_id']).to eq(restricted_user.id)
  end

  it 'forbids admins without risk control access' do
    get '/api/v1/admin/risk_controls', headers: auth_headers(support_admin)

    expect(response).to have_http_status(:forbidden)
  end
end
