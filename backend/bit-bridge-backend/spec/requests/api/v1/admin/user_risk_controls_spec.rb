# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Admin::UserRiskControls', type: :request do
  let(:target_user) { create(:user, :confirmed, email: 'risk-target@example.com') }
  let(:compliance_admin) do
    create(:user, :confirmed, email: 'risk-compliance@example.com', role: 'admin', admin_role: 'compliance', admin_auth_time: Time.current)
  end
  let(:support_admin) do
    create(:user, :confirmed, email: 'risk-support@example.com', role: 'admin', admin_role: 'support', admin_auth_time: Time.current)
  end

  describe 'GET /api/v1/admin/users/:user_id/risk_control' do
    it 'returns defaults when no risk control exists' do
      get "/api/v1/admin/users/#{target_user.id}/risk_control", headers: auth_headers(compliance_admin)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.dig('data', 'monitoring_enabled')).to eq(false)
      expect(body.dig('data', 'restricted')).to eq(false)
    end

    it 'forbids admins without risk control access' do
      get "/api/v1/admin/users/#{target_user.id}/risk_control", headers: auth_headers(support_admin)

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe 'PATCH /api/v1/admin/users/:user_id/risk_control' do
    it 'creates and updates a risk control for authorized admins' do
      allow(Risk::ProviderAccountFreeze).to receive(:freeze_for_user!).and_return(status: :noop)

      patch "/api/v1/admin/users/#{target_user.id}/risk_control",
            params: {
              risk_control: {
                monitoring_enabled: true,
                auto_lock_enabled: true,
                single_txn_limit_cents: 100_000,
                daily_limit_cents: 250_000,
                restricted: true,
                restriction_reason: 'clustered signup review'
              }
            },
            headers: auth_headers(compliance_admin)

      expect(response).to have_http_status(:ok)

      control = target_user.reload.user_risk_control
      expect(control.monitoring_enabled).to eq(true)
      expect(control.auto_lock_enabled).to eq(true)
      expect(control.single_txn_limit_cents).to eq(100_000)
      expect(control.daily_limit_cents).to eq(250_000)
      expect(control.restricted).to eq(true)
      expect(control.restriction_reason).to eq('clustered signup review')

      audit = AdminAuditEvent.where(admin_user_id: compliance_admin.id, target_user_id: target_user.id, action: 'risk_control.update').last
      expect(audit).to be_present
    end

    it 'triggers provider unfreeze when a restricted control is released' do
      target_user.create_user_risk_control!(
        monitoring_enabled: true,
        restricted: true,
        restriction_reason: 'review'
      )
      allow(Risk::ProviderAccountFreeze).to receive(:unfreeze_for_user!).and_return(status: :noop)

      patch "/api/v1/admin/users/#{target_user.id}/risk_control",
            params: {
              risk_control: {
                monitoring_enabled: true,
                restricted: false
              }
            },
            headers: auth_headers(compliance_admin)

      expect(response).to have_http_status(:ok)
      expect(Risk::ProviderAccountFreeze).to have_received(:unfreeze_for_user!)
    end

    it 'validates auto lock requires monitoring' do
      patch "/api/v1/admin/users/#{target_user.id}/risk_control",
            params: {
              risk_control: {
                monitoring_enabled: false,
                auto_lock_enabled: true
              }
            },
            headers: auth_headers(compliance_admin)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body)['message']).to include('requires monitoring')
    end
  end
end
