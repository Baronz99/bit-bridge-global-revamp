# frozen_string_literal: true

class Transaction < ApplicationRecord
  belongs_to :wallet
  has_one_attached :proof
  has_one :user, through: :wallet
  has_many :accounts, through: :user
  has_one :transaction_record, foreign_key: 'exchange_id'
  belongs_to :account, optional: true

  attr_accessor :coupon_code

  enum :status, { pending: 0, approved: 1, declined: 2, initialized: 3, failed: 4 }
  enum :transaction_type, { deposit: 0, withdrawal: 1 }
  enum :coin_type, { bank: 0, bitcoin: 1, dodgecoin: 2, usdt: 3, mobile_bank: 4 }

  default_scope { order(created_at: :desc) }

  validate :validate_transaction_on_create, if: :withdrawal_status_pending_or_approved?, on: :create
  validate :validate_transaction_on_update, if: :withdrawal_status_pending_or_approved?, on: :update

  validates :address, presence: true, if: :withdrawal?
  validates :amount, presence: true, numericality: { greater_than: 0 }
  validate :validate_money_scale

  before_save :set_coupon_bonus, if: :coupon?
  before_save :check_method_payment
  before_save :normalize_money_fields
  after_commit :enqueue_receipt_email, on: %i[create update]

  def validate_transaction_on_create
    return if ledger_hold_reserved?
    return unless (amount > wallet.balance) && status != 'declined'
    errors.add(:amount, 'insufficient balance')
  end

  def validate_transaction_on_update
    return if ledger_hold_reserved?
    return unless (amount > wallet.real_balance) && status != 'declined'
    errors.add(:amount, 'insufficient balance')
  end

  # ✅ Keep old behavior: bank deposit auto-approves
  def check_method_payment
    return unless coin_type == 'bank' && transaction_type == 'deposit'
    self.status = 'approved'
  end

  def deposit_amount
    amount + (bonus || 0)
  end

  def currency
    return self[:currency] if respond_to?(:has_attribute?) && has_attribute?(:currency)

    wallet&.currency
  end

  def email
    user&.email || wallet&.user&.email
  end

  def set_coupon_bonus
    self.bonus = amount * 0.05
  end

  def normalize_money_fields
    self.amount = MoneyScale.normalize(amount)
    self.bonus = MoneyScale.normalize(bonus)
    self.amount_cents = Money.to_cents(amount, wallet&.currency)
    self.bonus_cents = Money.to_cents(bonus, wallet&.currency)
  end

  def validate_money_scale
    {
      amount: amount,
      bonus: bonus
    }.each do |field, value|
      raw_value = read_attribute_before_type_cast(field)
      check_value = raw_value.nil? ? value : raw_value
      next if MoneyScale.valid_scale?(check_value)

      errors.add(field, 'must have at most 2 decimal places')
    end
  end

  def coupon?
    coupon_code.to_s.strip == 'SUPERSTRIKERS'
  end

  def proof_url
    Rails.application.routes.url_helpers.url_for(proof) if proof.attached?
  end

  private

  def withdrawal?
    transaction_type == 'withdrawal'
  end

  def withdrawal_status_pending_or_approved?
    transaction_type == 'withdrawal' && %w[approved pending].include?(status)
  end
 
  def ledger_hold_reserved?
    metadata.is_a?(Hash) && metadata['ledger_hold_reserved'].present?
  end

  public

  def enqueue_receipt_email
    return unless receipt_email_eligible?

    SendTransactionReceiptJob.perform_later(id)
  rescue StandardError
    nil
  end

  def receipt_email_eligible?
    return false unless approved_transition?
    receipt_email_sendable?
  end

  def receipt_email_sendable?
    return false unless approved?
    return false if email.blank?

    if conversion_transaction?
      withdrawal?
    else
      deposit?
    end
  end

  def approved_transition?
    return false unless approved?

    status_change = previous_changes['status']
    return true if status_change.present? && status_change.last.to_s == 'approved' && status_change.first.to_s != 'approved'

    previous_changes.key?('id')
  end

  def conversion_transaction?
    meta = metadata.is_a?(Hash) ? metadata : {}
    return true if meta['fx_quote_token'].present?

    address.to_s.include?('Tunnel Conversion')
  end
end
