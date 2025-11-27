# frozen_string_literal: true

class ProvisionSerializer < ActiveModel::Serializer
  attributes :id, :name, :min_value, :max_value, :provision_value_type, :currency, :description, :value_range,
             :service_type, :notice
  has_one :product
  has_many :order_items
end
