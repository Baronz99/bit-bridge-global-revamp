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


  before_save :set_coupon_bonus, if: :coupon?
  before_save :check_method_payment


  def validate_transaction_on_create
    return unless (amount > wallet.balance) && status != 'declined'

    errors.add(:amount, 'insufficient balance')
  end

  def validate_transaction_on_update
    return unless (amount > wallet.real_balance) && status != 'declined'

    errors.add(:amount, 'insufficient balance')
  end

  def check_method_payment
    return unless coin_type === 'bank' && transaction_type == 'deposit'

    self.status = 'approved'
  end

  def deposit_amount
    amount + (bonus || 0)
  end

  def email
    user.email
  end

  def set_coupon_bonus
    self.bonus = amount * 0.05
  end

  def coupon?
    coupon_code.to_s.strip === 'SUPERSTRIKERS'
  end


  # def insert_usd

  # end










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
end
