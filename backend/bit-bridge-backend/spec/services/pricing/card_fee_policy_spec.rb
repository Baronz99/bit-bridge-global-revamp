# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Pricing::CardFeePolicy do
  it 'calculates funding fee from bps with cap' do
    setting = FxSetting.current
    setting.update!(card_funding_fee_bps: 200, card_funding_fee_cap_usd_cents: 150)

    policy = described_class.new(setting: setting)
    fee = policy.funding_fee_usd(100)

    expect(fee.to_f).to eq(1.5)
  end

  it 'returns zero when bps is zero' do
    setting = FxSetting.current
    setting.update!(card_withdrawal_fee_bps: 0)

    policy = described_class.new(setting: setting)
    fee = policy.withdrawal_fee_usd(50)

    expect(fee.to_f).to eq(0.0)
  end
end
