class User < ApplicationRecord
  attr_accessor :old_password, :confirm_password, :mode, :password_token

  include Devise::JWT::RevocationStrategies::JTIMatcher
  # Include default devise modules. Others available are:
  # :lockable, :timeoutable, :trackable and :omniauthable
  devise :database_authenticatable, :registerable, :confirmable,
         :recoverable, :rememberable, :validatable, :jwt_authenticatable, jwt_revocation_strategy: self

  has_one :wallet, class_name: 'Wallet'
  has_many :transactions, through: :wallet
  has_many :order_details
  has_many :order_items, through: :order_details
  has_many :card_tokens, through: :order_items
  has_one :user_profile
  has_many :bill_orders
  has_many :accounts
  has_many :cards

  accepts_nested_attributes_for :user_profile

  # 👇 NEW: auto-confirm in staging
  before_create :skip_confirmation_in_staging

  after_create :initialize_wallet

  default_scope { order(created_at: :desc) }

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
    # Don't raise - allow signup to continue even if wallet creation fails
  end

  def generate_refresh_token
    token = SecureRandom.hex(32)
    update!(refresh_token: token, refresh_token_expires_at: 30.minutes.from_now)
    token
  end

  # 👉 Check only expiry here
  def refresh_token_expired?
    return false if refresh_token_expires_at.blank?

    refresh_token_expires_at < Time.current
  end

  # 👉 Compare the raw token value with what's stored (constant-time)
  #    Expiry is handled separately (e.g. in the controller using refresh_token_expired?)
  def validate_refresh_token(raw)
    return false if refresh_token.blank? || raw.blank?

    ActiveSupport::SecurityUtils.secure_compare(refresh_token, raw)
  end

  def revoke_refresh_token!
    update!(refresh_token: nil, refresh_token_expires_at: nil)
  end

  private

  # ✅ In staging, we don't want email confirmation to block demos,
  # so we mark users as confirmed immediately.
  def skip_confirmation_in_staging
    skip_confirmation! if Rails.env.production? || ENV['RAILS_ENV'] == 'staging'
  end
end