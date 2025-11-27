# frozen_string_literal: true

class UserSerializer < ActiveModel::Serializer
  attributes :id,
             :email,
             :created_at,
             :admin,
             :reset_password_token,
             :role,
             :password,
             :active,
             :onboarding_stage,
             :primary_use_case,
             :kyc_level,
             :id_type
             # id_number removed – no longer needed in responses

  has_one  :wallet
  has_many :bill_orders
  has_one  :user_profile
  has_many :transactions
  has_many :accounts
end
