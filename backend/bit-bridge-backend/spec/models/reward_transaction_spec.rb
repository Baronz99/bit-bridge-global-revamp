# frozen_string_literal: true

require 'rails_helper'

RSpec.describe RewardTransaction, type: :model do
  let(:user) { create(:user) }

  describe 'bill_order requirement' do
    it 'allows legacy_reward_spend without a bill order' do
      tx = described_class.new(
        user: user,
        bill_order: nil,
        amount: 5,
        reward_rate: 0,
        currency: 'NGN',
        service_type: 'legacy_reward_spend',
        status: :redeemed
      )

      expect(tx).to be_valid
    end

    it 'allows legacy_bonus without a bill order' do
      tx = described_class.new(
        user: user,
        bill_order: nil,
        amount: 3,
        reward_rate: 0,
        currency: 'NGN',
        service_type: 'legacy_bonus',
        status: :earned
      )

      expect(tx).to be_valid
    end

    it 'requires bill order for normal service types' do
      tx = described_class.new(
        user: user,
        bill_order: nil,
        amount: 10,
        reward_rate: 0.01,
        currency: 'NGN',
        service_type: 'VTU',
        status: :earned
      )

      expect(tx).not_to be_valid
      expect(tx.errors[:bill_order_id]).to include("can't be blank")
    end
  end
end
