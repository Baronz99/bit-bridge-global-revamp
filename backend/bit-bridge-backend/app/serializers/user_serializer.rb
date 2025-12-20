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
             :transaction_pin_set

  has_one  :wallet
  has_many :bill_orders
  has_one  :user_profile
  has_many :transactions
  has_many :accounts

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
end
