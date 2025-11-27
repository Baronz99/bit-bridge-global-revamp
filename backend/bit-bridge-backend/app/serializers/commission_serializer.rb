# frozen_string_literal: true

class CommissionSerializer < ActiveModel::Serializer
  attributes :id, :deposit, :withdrawal, :amount
  has_one :user
end
