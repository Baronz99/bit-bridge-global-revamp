# frozen_string_literal: true

class OrderDetail < ApplicationRecord
  has_one_attached :proof
  belongs_to :user
  has_one :wallet, through: :user
  has_many :order_items
  has_many :card_tokens, through: :order_items
  has_many :provisions, through: :order_items
  # validates :total_amount, presence: true,  numericality: {greater_than: 0}
  enum :order_type, { buy: 0, sell: 1 }
  enum :payment_method, { wallet: 0 }
  enum :status, { pending: 0, approved: 1, declined: 2 }

  validate :approve_order, if: :order_status_buy?

  before_validation :calculate_total_amount, if: -> { order_items.any?(&:changed?) }

  before_save :set_total_amount
  before_save :set_net_amount
  accepts_nested_attributes_for :order_items

  attr_accessor :calculate_total

  def add_total
    @add_total ||= begin
      conversion = CurrencyService.new('usd', 'usd')

      order_items.collect { |item| conversion.get_calculated_rate(item.amount, item.currency, 'usd')[:rate] }.sum
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

  def set_net_amount
    self.net_total = ((10 / 100) * add_total) + add_total
  end

  def set_total_amount
    self.total_amount = calculate_total || add_total
  end

  def proof_url
    Rails.application.routes.url_helpers.url_for(proof) if proof.attached?
  end
end
