# frozen_string_literal: true

module Rewards
  class Redeem
    REFERENCE_PREFIX = 'bill_order/reward_redeem'.freeze

    def self.call(bill_order:)
      new(bill_order: bill_order).call
    end

    def initialize(bill_order:)
      @bill_order = bill_order
    end

    def call
      return false unless eligible?
      return false if redeemed_exists?

      RewardTransaction.create!(
        user_id: bill_order.user_id,
        bill_order_id: bill_order.id,
        amount: reward_applied,
        source_amount: gross_amount,
        reward_rate: 0,
        currency: 'NGN',
        service_type: bill_order.service_type,
        source_label: bill_order.biller.presence || bill_order.service_type,
        status: :redeemed,
        earned_at: Time.current,
        metadata: {
          source: 'bill_order_reward_redeem',
          reference: reference
        }
      )
      true
    end

    private

    attr_reader :bill_order

    def eligible?
      bill_order.completed? &&
        bill_order.payment_method.to_s == 'wallet' &&
        reward_applied.positive?
    end

    def redeemed_exists?
      RewardTransaction.where(
        bill_order_id: bill_order.id,
        status: :redeemed
      ).exists?
    end

    def reward_applied
      (bill_order.reward_applied || 0).to_d
    end

    def gross_amount
      (bill_order.total_amount.presence || bill_order.amount).to_d
    end

    def reference
      "#{REFERENCE_PREFIX}/#{bill_order.id}"
    end
  end
end
