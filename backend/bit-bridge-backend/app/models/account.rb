# frozen_string_literal: true

class Account < ApplicationRecord
  # validates :account_id, presence: true, uniqueness: true
  belongs_to :user
  has_many :transactions
  has_many :transactions, through: :user

  enum account_type: { individual: 0, business: 1 }
  enum gender: { male: 0, female: 1 }
  enum status: { unverified: 0, verifying: 1, verified: 2, completed: 3 }

  validate :single_active_anchor_account_per_user
  validate :unique_anchor_account_number

  private

  def single_active_anchor_account_per_user
    return unless vendor.to_s == 'anchor'
    return unless active?
    return if user_id.blank?

    scope = self.class.where(user_id: user_id, vendor: 'anchor', active: true)
    scope = scope.where.not(id: id) if persisted?
    return unless scope.exists?

    errors.add(:active, 'only one active Anchor account is allowed per user')
  end

  def unique_anchor_account_number
    number = account_number.to_s.strip
    return if number.blank?
    return unless vendor.to_s == 'anchor' || vendor.blank?

    scope = self.class.where(account_number: number)
    scope = scope.where("vendor = 'anchor' OR vendor IS NULL")
    scope = scope.where.not(id: id) if persisted?
    return unless scope.exists?

    errors.add(:account_number, 'already exists for another Anchor account')
  end
end
