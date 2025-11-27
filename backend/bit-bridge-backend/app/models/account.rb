# frozen_string_literal: true

class Account < ApplicationRecord
  # validates :account_id, presence: true, uniqueness: true
  belongs_to :user
  has_many :transactions
  has_many :transactions, through: :user

  enum account_type: { individual: 0, business: 1 }
  enum gender: { male: 0, female: 1 }
  enum status: { unverified: 0, verifying: 1, verified: 2, completed: 3 }
end
