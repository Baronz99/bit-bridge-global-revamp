# frozen_string_literal: true

class User < ApplicationRecord
  attr_accessor :old_password, :confirm_password, :mode, :password_token

  include Devise::JWT::RevocationStrategies::JTIMatcher

  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable, :jwt_authenticatable,
         jwt_revocation_strategy: self

  has_one :wallet, class_name: 'Wallet'
  has_many :transactions, through: :wallet
  has_many :order_details
  has_many :order_items, through: :order_details
  has_many :card_tokens, through: :order_items
  has_one :user_profile
  has_many :bill_orders
  has_many :accounts
  has_many :cards

  has_many :circle_memberships, dependent: :destroy
  has_many :circles, through: :circle_memberships
  has_many :owned_circles, class_name: 'Circle', foreign_key: :owner_id, inverse_of: :owner

  accepts_nested_attributes_for :user_profile

  after_create :initialize_wallet

  default_scope { order(created_at: :desc) }

  # =========================
  # Transaction PIN lockout settings
  # =========================
  MAX_TRANSACTION_PIN_ATTEMPTS = 5
  TRANSACTION_PIN_LOCK_MINUTES = 15

  def full_name
    "#{user_profile.first_name} #{user_profile.last_name}"
  end

  def user_net_expense
    order_details.sum(:total_amount)
  end

  def total_sale
    order_details.where(order_type: 'sell', status: 'approved').sum(:total_amount)
  end

  def admin
    role == 'admin'
  end

  def initialize_wallet
    create_wallet
  rescue StandardError => e
    Rails.logger.error "Failed to create wallet: #{e.message}"
  end

  def generate_refresh_token
    token = SecureRandom.hex(32)
    update!(refresh_token: token, refresh_token_expires_at: 30.minutes.from_now)
    token
  end

  def refresh_token_expired?
    return false if refresh_token_expires_at.blank?
    refresh_token_expires_at < Time.current
  end

  def validate_refresh_token(raw)
    return false if refresh_token.blank? || raw.blank?
    ActiveSupport::SecurityUtils.secure_compare(refresh_token, raw)
  end

  def revoke_refresh_token!
    update!(refresh_token: nil, refresh_token_expires_at: nil)
  end

  # =========================
  # Transaction PIN helpers
  # =========================

  def transaction_pin_set?
    transaction_pin_digest.present?
  end

  def set_transaction_pin!(raw_pin)
    pin = raw_pin.to_s.strip
    raise ArgumentError, 'PIN must be exactly 4 digits' unless pin.match?(/\A\d{4}\z/)

    digest = BCrypt::Password.create(pin)
    update!(
      transaction_pin_digest: digest,
      transaction_pin_set_at: Time.current
    )

    # ✅ When PIN is set/changed, reset lockout state
    reset_transaction_pin_attempts!
  end

  def valid_transaction_pin?(raw_pin)
    return false if transaction_pin_digest.blank?
    pin = raw_pin.to_s.strip
    return false unless pin.match?(/\A\d{4}\z/)
    BCrypt::Password.new(transaction_pin_digest) == pin
  rescue BCrypt::Errors::InvalidHash
    false
  end

  # =========================
  # Transaction PIN brute-force protection
  # =========================

  def transaction_pin_locked?
    return false if transaction_pin_locked_until.blank?
    transaction_pin_locked_until > Time.current
  end

  def transaction_pin_lock_remaining_seconds
    return 0 unless transaction_pin_locked?
    (transaction_pin_locked_until - Time.current).to_i
  end

  def reset_transaction_pin_attempts!
    update!(
      transaction_pin_attempts: 0,
      transaction_pin_locked_until: nil
    )
  end

  def register_failed_transaction_pin_attempt!
    attempts = (transaction_pin_attempts || 0) + 1

    if attempts >= MAX_TRANSACTION_PIN_ATTEMPTS
      update!(
        transaction_pin_attempts: attempts,
        transaction_pin_locked_until: TRANSACTION_PIN_LOCK_MINUTES.minutes.from_now
      )
    else
      update!(transaction_pin_attempts: attempts)
    end

    attempts
  end

  # ✅ Single call you can use anywhere to validate + lockout + reset
  # Returns:
  # - :locked if currently locked
  # - true if valid (and resets attempts)
  # - false if invalid (increments attempts, maybe locks)
  def verify_transaction_pin_with_lockout(raw_pin)
    return :locked if transaction_pin_locked?

    if valid_transaction_pin?(raw_pin)
      reset_transaction_pin_attempts!
      return true
    end

    register_failed_transaction_pin_attempt!
    false
  end
end
