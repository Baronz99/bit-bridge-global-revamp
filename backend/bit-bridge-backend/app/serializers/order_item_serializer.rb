# frozen_string_literal: true

class OrderItemSerializer < ActiveModel::Serializer
  attributes :id, :quantity, :amount, :provision, :product, :card_token
  belongs_to :product
  belongs_to :order_details
  belongs_to :provision
  has_one :card_token
end
