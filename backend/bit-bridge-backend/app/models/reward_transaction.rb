# frozen_string_literal: true

class RewardTransaction < ApplicationRecord
  belongs_to :user
  belongs_to :bill_order, optional: true

  enum :status, { pending: 0, earned: 1, revoked: 2, redeemed: 3, expired: 4 }

  validates :amount, presence: true, numericality: { greater_than: 0 }
  validates :reward_rate, presence: true
  validates :currency, presence: true
  validates :bill_order_id, presence: true, if: -> { service_type.in?(%w[VTU DATA POWER CABLE]) }
# ^ adjust list to whatever your real service_types are


  scope :earned_sum, ->(user_id) { where(user_id: user_id, status: :earned).sum(:amount) }
  scope :redeemed_sum, ->(user_id) { where(user_id: user_id, status: :redeemed).sum(:amount) }
  scope :expired_sum, ->(user_id) { where(user_id: user_id, status: %i[expired revoked]).sum(:amount) }

  def self.available_sum_for(user_id)
    earned_sum(user_id).to_d - redeemed_sum(user_id).to_d - expired_sum(user_id).to_d
  end
end
