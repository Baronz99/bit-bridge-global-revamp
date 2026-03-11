# frozen_string_literal: true

class Product < ApplicationRecord
  CURRENCIES = {
    ngn: 0,
    usd: 1,
    gbp: 2,
    eur: 3,
    btc: 4,
    eth: 5,
    doge: 6
  }.freeze

  has_one_attached :photo
  has_many :order_items
  has_many :provisions, dependent: :destroy

  enum :category, { 'mobile provider' => 0, 'gift card' => 1, service: 2, utility: 3, power: 4, crypto: 5 }
  enum :currency, CURRENCIES

  before_validation :normalize_provider

  validates :provider, presence: true
  validates :category, presence: true
  validates :currency, presence: true
  validates :rate, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true

  def photo_url
    Rails.application.routes.url_helpers.url_for(photo) if photo.attached?
  end

  private

  def normalize_provider
    self.provider = provider.to_s.strip.presence
  end
end

# bbc9f42b3aae0f9c00e9b53ec48588aa3d32db131e118dd8955b3394b547e9a13572f1b499caf7cccb0bc4e61b080d82fc056321b56eb01bcac62fb6bcd0191c
