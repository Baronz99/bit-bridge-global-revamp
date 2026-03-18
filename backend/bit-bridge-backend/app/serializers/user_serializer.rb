# frozen_string_literal: true

class UserSerializer < ActiveModel::Serializer
  attributes :id,
             :email,
             :created_at,
             :admin,
             :role,
             :admin_role,
             :admin_flags,
             :active,
             :onboarding_stage,
             :primary_use_case,
             :kyc_level,
             :id_type,
             :phone_verified,
             :phone_verified_at,
             :phone_e164,
             :badges,
             :transaction_pin_set,
             :transaction_pin_locked,
             :transaction_pin_lock_remaining_seconds

  has_one  :wallet
  has_many :wallets, if: :admin_scope?
  has_many :bill_orders
  has_one  :user_profile
  has_one  :user_kyc
  has_many :transactions
  has_many :accounts
  has_many :cards, if: :admin_scope?

  def email
    return object.email unless admin_scope?

    mask_email(object.email)
  end

  def admin_role
    object.admin_role
  end

  def admin_flags
    return {} unless admin_scope?

    { card_debug_enabled: FeatureFlags.admin_card_debug? }
  end

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

  def badges
    object.user_badges
          .includes(:badge, :source_circle)
          .order(granted_at: :desc, created_at: :desc)
          .map do |grant|
      {
        key: grant.badge&.key,
        name: grant.badge&.name,
        granted_at: grant.granted_at,
        source_circle_id: grant.source_circle_id,
        source_circle_name: grant.source_circle&.name
      }
    end
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

  def mask_email(value)
    return "" if value.to_s.strip.empty?

    name, domain = value.split('@', 2)
    return value if domain.blank?
    return "*@#{domain}" if name.length < 2

    head = name[0, 2]
    tail = name[-1, 1]
    "#{head}***#{tail}@#{domain}"
  end
end
