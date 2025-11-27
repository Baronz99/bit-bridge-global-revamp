# frozen_string_literal: true

class Product < ApplicationRecord
  has_one_attached :photo
  has_many :order_items
  has_many :provisions

  enum :category, { 'mobile provider' => 0, 'gift card' => 1, service: 2, utility: 3, power: 4, crypto: 5 }

  def photo_url
    Rails.application.routes.url_helpers.url_for(photo) if photo.attached?
  end
end

# bbc9f42b3aae0f9c00e9b53ec48588aa3d32db131e118dd8955b3394b547e9a13572f1b499caf7cccb0bc4e61b080d82fc056321b56eb01bcac62fb6bcd0191c
