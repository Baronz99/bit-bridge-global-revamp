# frozen_string_literal: true

class RewardTransaction < ApplicationRecord
  belongs_to :user
  belongs_to :bill_order, optional: true

  enum :status, { pending: 0, earned: 1, revoked: 2 }

  validates :amount, presence: true, numericality: { greater_than: 0 }
  validates :reward_rate, presence: true
  validates :currency, presence: true
end
