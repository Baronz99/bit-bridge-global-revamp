# frozen_string_literal: true

class OrderDetail < ApplicationRecord
  has_one_attached :proof
  belongs_to :user
  has_one :wallet, through: :user
  has_many :order_items
  has_many :card_tokens, through: :order_items
  has_many :provisions, through: :order_items
  # validates :total_amount, presence: true,  numericality: {greater_than: 0}
  enum :order_type, { buy: 0, sell: 1, vtu: 2 }
  enum :payment_method, { wallet: 0 }
  enum :status, { pending: 0, approved: 1, declined: 2 }

  validate :approve_order, if: :order_status_buy?

  before_validation :calculate_total_amount, if: -> { order_items.any?(&:changed?) }

  before_save :set_total_amount
  before_save :set_net_amount
  accepts_nested_attributes_for :order_items

  attr_accessor :calculate_total, :invalid_amounts_found

  def add_total
    @add_total ||= begin
      conversion = CurrencyService.new('usd', 'usd')
      invalid = false
      total = order_items.collect do |item|
        amount_bd = safe_decimal(item.amount) { invalid = true }
        rate_hash = conversion.get_calculated_rate(amount_bd || 0, item.currency, 'usd')
        rate_bd = safe_decimal(rate_hash[:rate] || rate_hash['rate']) { invalid = true }

        if amount_bd.nil? || rate_bd.nil?
          invalid = true
          nil
        else
          amount_bd * rate_bd
        end
      rescue StandardError => e
        invalid = true
        Rails.logger.error("[ORDER_DETAIL] amount conversion failed: #{e.class} - #{e.message}")
        nil
      end.compact

      sum = total.sum(BigDecimal('0'))
      self.invalid_amounts_found = invalid
      sum
    end
  end

  def approve_order
    return unless wallet.balance < add_total

    errors.add(:total_amount, 'insufficient fund')
  end

  def order_status_buy?
    order_type == 'buy'
  end

  def calculate_total_amount
    self.calculate_total = add_total
  end

  validate :reject_invalid_amounts

  def set_net_amount
    base = calculate_total || add_total
    self.net_total = (0.10 * base) + base
  end

  def set_total_amount
    self.total_amount = calculate_total || add_total
  end

  def proof_url
    Rails.application.routes.url_helpers.url_for(proof) if proof.attached?
  end

  private

  def safe_decimal(val, errs = nil)
    BigDecimal(val.to_s)
  rescue StandardError
    self.invalid_amounts_found = true
    yield if block_given?
    nil
  end

  def reject_invalid_amounts
    add_total if @add_total.nil?
    flagged = invalid_amounts_found
    flagged ||= order_items.any? { |i| amount_invalid?(i.amount) }
    flagged ||= (@add_total == BigDecimal('0') && order_items.any?)
    errors.add(:total_amount, 'invalid amount') if flagged
  end

  def amount_invalid?(val)
    BigDecimal(val.to_s)
    false
  rescue StandardError
    true
  end
end
