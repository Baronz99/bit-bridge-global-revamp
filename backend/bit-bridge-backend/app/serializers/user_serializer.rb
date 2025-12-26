# frozen_string_literal: true

class UserSerializer < ActiveModel::Serializer
  attributes :id,
             :email,
             :created_at,
             :admin,
             :role,
             :active,
             :onboarding_stage,
             :primary_use_case,
             :kyc_level,
             :id_type,
             :phone_verified,
             :phone_verified_at,
             :phone_e164,
             :transaction_pin_set,
             :transaction_pin_locked,
             :transaction_pin_lock_remaining_seconds

  has_one  :wallet
  has_many :wallets, if: :admin_scope?
  has_many :bill_orders
  has_one  :user_profile
  has_many :transactions
  has_many :accounts
  has_many :cards, if: :admin_scope?

  def phone_verified
    object.user_profile&.phone_verified_at.present?
  end

  def phone_verified_at
    object.user_profile&.phone_verified_at
  end

  def phone_e164
    object.user_profile&.phone_e164.presence || object.user_profile&.phone_number
  end

  def transaction_pin_set
    object.transaction_pin_set?
  end

  def transaction_pin_locked
    object.transaction_pin_locked?
  end

  def transaction_pin_lock_remaining_seconds
    object.transaction_pin_lock_remaining_seconds
  end

  def admin_scope?
    scope.respond_to?(:admin?) && scope.admin?
  end
end
