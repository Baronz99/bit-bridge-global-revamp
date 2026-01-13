# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Cards::MonthlyMaintenanceCharger do
  let(:user) { create(:user) }
  let(:wallet) { user.usd_wallet }
  let(:card) { user.cards.create!(card_id: 'card_123', status: 'active') }

  before do
    wallet.update!(balance_cents: 10_000)
    FxSetting.current.update!(card_monthly_maintenance_fee_usd_cents: 100)
  end

  it 'charges once per month per card' do
    time = Time.zone.parse('2026-01-15')
    result = described_class.call(reference_time: time)

    expect(result[:charged]).to eq(1)
    expect(
      Transaction.where(unique_transaction_id: "card-maintenance-#{card.id}-2026-01").count
    ).to eq(1)

    result = described_class.call(reference_time: time)
    expect(result[:charged]).to eq(0)
  end
end
