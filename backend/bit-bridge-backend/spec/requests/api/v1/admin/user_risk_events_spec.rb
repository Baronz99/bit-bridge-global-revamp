# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Admin::UserRiskEvents', type: :request do
  let(:target_user) { create(:user, :confirmed, email: 'risk-events-user@example.com') }
  let(:compliance_admin) do
    create(:user, :confirmed, email: 'risk-events-compliance@example.com', role: 'admin', admin_role: 'compliance', admin_auth_time: Time.current)
  end
  let(:support_admin) do
    create(:user, :confirmed, email: 'risk-events-support@example.com', role: 'admin', admin_role: 'support', admin_auth_time: Time.current)
  end

  before do
    target_user.risk_events.create!(
      trigger_type: 'single_inbound_limit',
      amount_cents: 200_000,
      threshold_cents: 100_000,
      action_taken: 'restricted',
      source_type: 'FundingIntent',
      source_id: SecureRandom.uuid,
      metadata: { provider: 'anchor' }
    )
  end

  it 'returns risk events for an authorized admin' do
    get "/api/v1/admin/users/#{target_user.id}/risk_events",
        headers: auth_headers(compliance_admin)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body.dig('summary', 'total')).to eq(1)
    expect(body.fetch('data').first['trigger_type']).to eq('single_inbound_limit')
  end

  it 'forbids admins without risk control access' do
    get "/api/v1/admin/users/#{target_user.id}/risk_events",
        headers: auth_headers(support_admin)

    expect(response).to have_http_status(:forbidden)
  end
end
