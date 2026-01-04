# frozen_string_literal: true

class CardSerializer < ActiveModel::Serializer
  attributes :id, :cardholder_id, :card_id, :transaction_reference, :card_type, :card_brand, :card_currency,
             :card_limit, :funding_amount, :status, :meta_data,
             :card_limit_usd, :funding_amount_usd

  has_one :user

  def card_limit_usd
    normalize_usd_cents(object.card_limit)
  end

  def funding_amount_usd
    normalize_usd_cents(object.funding_amount)
  end

  private

  def normalize_usd_cents(value)
    return nil if value.nil?
    amount = value.to_d rescue nil
    return nil unless amount
    # Bridge stores USD limits in cents when >= 100000.
    amount > 100000 ? (amount / 100).to_f : amount.to_f
  end
end
