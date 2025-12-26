# frozen_string_literal: true

class User < ApplicationRecord
  attr_accessor :old_password, :confirm_password, :mode, :password_token

  include Devise::JWT::RevocationStrategies::JTIMatcher

  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable, :jwt_authenticatable,
         jwt_revocation_strategy: self

  # ✅ Multi-wallet support
  has_many :wallets, class_name: 'Wallet', dependent: :nullify

  # ✅ Keep "wallet" as the NGN wallet so old code keeps working
  has_one :wallet, -> { where(wallet_type: :ngn) }, class_name: 'Wallet'

  has_many :transactions, through: :wallets

  has_many :order_details
  has_many :order_items, through: :order_details
  has_many :card_tokens, through: :order_items
  has_one :user_profile
  has_many :bill_orders
  has_many :accounts
  has_many :cards
  has_many :beneficiaries, dependent: :destroy

  has_many :circle_memberships, dependent: :destroy
  has_many :circles, through: :circle_memberships
  has_many :owned_circles, class_name: 'Circle', foreign_key: :owner_id, inverse_of: :owner

  accepts_nested_attributes_for :user_profile

  after_create :initialize_wallets

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

  def admin?
    admin || role == 'super_admin'
  end

  # ✅ Ensure NGN wallet exists on signup (no behaviour change)
  def initialize_wallets
    ensure_wallet!(:ngn)
  rescue StandardError => e
    Rails.logger.error "Failed to create wallet(s): #{e.message}"
  end

  # ✅ Create wallet on demand for any supported type
  def ensure_wallet!(type)
    wt = type.to_s.downcase

    # We do NOT want to create/return "usdt" for production,
    # but we keep enum value for legacy compatibility.
    wt = 'usd' if wt == 'usdt'

    wallet = wallets.find_by(wallet_type: wt)
    return wallet if wallet.present?

    currency =
      case wt
      when 'usd' then 'USD'
      else 'NGN'
      end

    wallets.create!(wallet_type: wt, currency:)
  end

  # Convenience helpers
  def ngn_wallet
    ensure_wallet!(:ngn)
  end

  def usd_wallet
    ensure_wallet!(:usd)
  end

  # -------------------------
  # Refresh token helpers
  # -------------------------
  def generate_refresh_token
    token = SecureRandom.hex(32)
    digest = self.class.refresh_token_digest(token)
    update!(
      refresh_token: token,
      refresh_token_digest: digest,
      refresh_token_expires_at: Time.current + refresh_token_ttl
    )
    token
  end

  def refresh_token_expired?
    return false if refresh_token_expires_at.blank?
    refresh_token_expires_at < Time.current
  end

  def validate_refresh_token(raw)
    refresh_token_valid?(raw)
  end

  def refresh_token_valid?(raw)
    return false if raw.blank?

    if refresh_token_digest.present?
      expected = self.class.refresh_token_digest(raw)
      ActiveSupport::SecurityUtils.secure_compare(refresh_token_digest, expected)
    else
      return false if refresh_token.blank?
      ActiveSupport::SecurityUtils.secure_compare(refresh_token, raw)
    end
  end

  def revoke_refresh_token!
    update!(
      refresh_token: nil,
      refresh_token_digest: nil,
      refresh_token_expires_at: nil
    )
  end

  def refresh_token_ttl
    ENV.fetch('AUTH_REFRESH_TOKEN_TTL_SECONDS', 30.days.to_i).to_i
  end

  def self.refresh_token_digest(raw)
    secret = ENV['AUTH_REFRESH_TOKEN_HMAC_SECRET'].presence || Rails.application.secret_key_base
    OpenSSL::HMAC.hexdigest('SHA256', secret, raw.to_s)
  end

  def self.find_by_refresh_token(raw, allow_legacy: true)
    return nil if raw.blank?

    digest = refresh_token_digest(raw)
    user = find_by(refresh_token_digest: digest)
    return user if user
    return nil unless allow_legacy

    find_by(refresh_token: raw)
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
