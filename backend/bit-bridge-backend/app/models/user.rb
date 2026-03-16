# frozen_string_literal: true

class User < ApplicationRecord
  attr_accessor :old_password, :confirm_password, :mode, :password_token

  include Devise::JWT::RevocationStrategies::JTIMatcher

  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable, :confirmable, :jwt_authenticatable,
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
  has_many :bill_payment_intents
  has_many :funding_intents, dependent: :destroy
  has_many :matched_inbound_bank_transfers, class_name: "InboundBankTransfer", foreign_key: :matched_user_id, inverse_of: :matched_user
  has_many :reward_transactions
  has_many :accounts
  has_many :cards
  has_many :notification_devices, dependent: :destroy
  has_many :notification_events, dependent: :destroy
  has_many :service_status_subscriptions, dependent: :destroy
  has_many :beneficiaries, dependent: :destroy
  has_one :user_kyc, dependent: :destroy
  has_many :kyc_reviews, dependent: :destroy
  has_many :refund_requests, dependent: :nullify
  has_many :handled_refund_requests,
           class_name: 'RefundRequest',
           foreign_key: :handled_by_admin_id,
           dependent: :nullify
  has_many :admin_audit_events_as_admin,
           class_name: 'AdminAuditEvent',
           foreign_key: :admin_user_id,
           dependent: :nullify
  has_many :admin_audit_events_as_target,
           class_name: 'AdminAuditEvent',
           foreign_key: :target_user_id,
           dependent: :nullify

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

  def transaction_pin_app_lock_enabled?
    transaction_pin_app_lock_enabled == true
  end

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
    role == 'admin' || role == 'super_admin'
  end

  def admin?
    admin || role == 'super_admin'
  end

  def admin_role
    return 'super_admin' if role == 'super_admin'
    return self[:admin_role].presence if self[:admin_role].present?
    return 'support' if admin?

    nil
  end

  def support?
    admin_role == 'support'
  end

  def ops?
    admin_role == 'ops'
  end

  def compliance?
    admin_role == 'compliance'
  end

  def super_admin?
    admin_role == 'super_admin'
  end

  def admin_access?
    admin? && admin_role.present?
  end

  def admin_session_fresh?(max_age: 10.minutes)
    return false if admin_auth_time.blank?

    admin_auth_time >= max_age.ago
  end

  ADMIN_FEATURES = {
    admin: %w[support ops compliance super_admin],
    kyc_review: %w[compliance super_admin],
    pricing_spec: %w[super_admin],
    ops_tools: %w[ops super_admin]
  }.freeze

  def can_access_admin_feature?(feature)
    return false unless admin?

    allowed = ADMIN_FEATURES[feature.to_sym] || []
    allowed.include?(admin_role)
  end

  KYC_RANKS = {
    'tier_0' => 0,
    'tier_1' => 1,
    'tier_2' => 2,
    'tier_3' => 3,
    'tier_4' => 4
  }.freeze

  def kyc_rank
    KYC_RANKS.fetch(kyc_level.to_s, 0)
  end

  def kyc_at_least?(required_level)
    required_rank = KYC_RANKS.fetch(required_level.to_s, 0)
    kyc_rank >= required_rank
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

  # Deliver Devise notifications asynchronously and never block auth flows
  # (signup/password reset) on mail transport/template failures.
  def send_devise_notification(notification, *args)
    devise_mailer.send(notification, self, *args).deliver_later
  rescue StandardError => e
    Rails.logger.error(
      "[DeviseNotification] notification=#{notification} user_id=#{id} " \
      "error=#{e.class} message=#{e.message}"
    )
    nil
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

