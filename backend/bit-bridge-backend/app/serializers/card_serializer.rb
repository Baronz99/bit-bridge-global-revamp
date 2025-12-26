# frozen_string_literal: true

class CardSerializer < ActiveModel::Serializer
  attributes :id, :cardholder_id, :card_id, :transaction_reference, :card_type, :card_brand, :card_currency,
             :card_limit, :funding_amount, :status, :meta_data
  has_one :user
end
