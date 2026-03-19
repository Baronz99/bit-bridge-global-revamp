# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Risk::ControlEnforcer do
  describe '.evaluate_inbound_credit!' do
    it 'auto restricts monitored users when the single transaction limit is exceeded' do
      user = create(:user, :confirmed, email: 'risk-enforcer@example.com')
      user.create_user_risk_control!(
        monitoring_enabled: true,
        auto_lock_enabled: true,
        single_txn_limit_cents: 50_000
      )

      result = described_class.evaluate_inbound_credit!(
        user: user,
        amount_cents: 75_000,
        source_type: 'FundingIntent',
        source_id: SecureRandom.uuid
      )

      expect(result[:triggered]).to eq(true)
      expect(result[:restricted]).to eq(true)
      expect(user.reload.user_risk_control.restricted).to eq(true)
      expect(user.risk_events.last&.trigger_type).to eq('single_txn_limit_exceeded')
      expect(user.risk_events.last&.action_taken).to eq('restricted')
    end

    it 'records a monitored event without restricting when auto lock is disabled' do
      user = create(:user, :confirmed, email: 'risk-monitor@example.com')
      user.create_user_risk_control!(
        monitoring_enabled: true,
        auto_lock_enabled: false,
        daily_limit_cents: 10_000
      )
      user.ngn_wallet.transactions.create!(
        transaction_type: :deposit,
        status: :approved,
        coin_type: :bank,
        amount: 90
      )

      result = described_class.evaluate_inbound_credit!(
        user: user,
        amount_cents: 2_000,
        source_type: 'FundingIntent',
        source_id: SecureRandom.uuid
      )

      expect(result[:triggered]).to eq(true)
      expect(result[:restricted]).to eq(false)
      expect(user.reload.user_risk_control.restricted).to eq(false)
      expect(user.risk_events.last&.action_taken).to eq('monitored')
    end
  end
end
