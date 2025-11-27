# frozen_string_literal: true

class ProductSerializer < ActiveModel::Serializer
  attributes :id, :featured, :extra_info, :provider, :provision, :header_info, :description, :rate, :info, :attention,
             :notice_info, :category

  has_many :provisions
end
