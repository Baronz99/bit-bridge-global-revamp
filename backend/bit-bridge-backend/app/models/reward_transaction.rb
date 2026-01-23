# frozen_string_literal: true

class RewardTransaction < ApplicationRecord
  belongs_to :user
  belongs_to :bill_order, optional: true

  enum :status, { pending: 0, earned: 1, revoked: 2, redeemed: 3, expired: 4 }

  validates :amount, presence: true, numericality: { greater_than: 0 }
  validates :reward_rate, presence: true
  validates :currency, presence: true
  validates :bill_order_id, presence: true, if: :requires_bill_order?


  scope :earned_sum, ->(user_id) { where(user_id: user_id, status: :earned).sum(:amount) }
  scope :redeemed_sum, ->(user_id) { where(user_id: user_id, status: :redeemed).sum(:amount) }
  scope :expired_sum, ->(user_id) { where(user_id: user_id, status: %i[expired revoked]).sum(:amount) }

  def self.available_sum_for(user_id)
    earned_sum(user_id).to_d - redeemed_sum(user_id).to_d - expired_sum(user_id).to_d
  end

  private

  # Legacy reward records (e.g., legacy_bonus, legacy_reward_spend) are not tied to a bill order.
  # All other service types must remain linked to a bill order to preserve auditability.
  def requires_bill_order?
    return false if service_type.blank?
    !%w[legacy_bonus legacy_reward_spend].include?(service_type)
  end
end
