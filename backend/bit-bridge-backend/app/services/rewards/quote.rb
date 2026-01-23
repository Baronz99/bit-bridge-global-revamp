# frozen_string_literal: true

module Rewards
  class Quote
    def self.call(bill_order:, use_rewards: true)
      new(bill_order: bill_order, use_rewards: use_rewards).call
    end

    def initialize(bill_order:, use_rewards: true)
      @bill_order = bill_order
      @use_rewards = use_rewards
    end

    def call
      gross = gross_amount
      available = RewardTransaction.available_sum_for(bill_order.user_id)
      reward_applied = apply_rewards? ? [available, gross].min : 0.to_d
      wallet_to_pay = gross - reward_applied

      {
        gross_amount: gross,
        reward_available: available,
        reward_applied: reward_applied,
        wallet_to_pay: wallet_to_pay
      }
    end

    private

    attr_reader :bill_order, :use_rewards

    def gross_amount
      (bill_order.total_amount.presence || bill_order.amount).to_d
    end

    def apply_rewards?
      use_rewards && bill_order.payment_method.to_s == 'wallet'
    end
  end
end
