# frozen_string_literal: true

class Provision < ApplicationRecord
  belongs_to :product, dependent: :destroy
  has_many :order_items
  enum :currency, { ngn: 0, usd: 1, gbp: 2, eur: 3, btc: 4, eth: 5, doge: 6 }

  before_save :insert_value
  # before_save :capitalize

  def insert_value
    self.min_value = value_range.min
    self.max_value = value_range.max
  end
end
