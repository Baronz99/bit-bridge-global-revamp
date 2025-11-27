# frozen_string_literal: true

class OrderDetailSerializer < ActiveModel::Serializer
  attributes :id, :order_type, :total_amount, :status, :payment_method, :viewed, :net_total, :created_at
  has_many :order_items
  has_one :user
end
