# frozen_string_literal: true

class CardSerializer < ActiveModel::Serializer
  attributes :id,
             :cardholder_id,
             :card_id,
             :transaction_reference,
             :card_type,
             :card_brand,
             :card_currency,
             :card_limit,
             :funding_amount,
             :status,
             :meta_data,
             :card_limit_usd,
             :funding_amount_usd,
             :card_last4,
             :exp_month,
             :exp_year

  has_one :user

  def card_id
    return object.card_id unless admin_scope?

    nil
  end

  def cardholder_id
    return object.cardholder_id unless admin_scope?

    nil
  end

  def transaction_reference
    return object.transaction_reference unless admin_scope?

    nil
  end

  def card_type
    return object.card_type unless admin_scope?

    nil
  end

  def card_limit
    return object.card_limit unless admin_scope?

    nil
  end

  def funding_amount
    return object.funding_amount unless admin_scope?

    nil
  end

  def meta_data
    return object.meta_data unless admin_scope?

    nil
  end

  def card_limit_usd
    return normalize_usd_cents(object.card_limit) unless admin_scope?

    nil
  end

  def funding_amount_usd
    return normalize_usd_cents(object.funding_amount) unless admin_scope?

    nil
  end

  def card_last4
    meta = object.meta_data || {}
    last4 =
      meta['last4'] ||
      meta['last_4'] ||
      meta['pan_last4'] ||
      meta['card_last4']

    return last4 if last4.present?

    raw = object.card_id.to_s
    raw.length >= 4 ? raw[-4, 4] : nil
  end

  def exp_month
    meta = object.meta_data || {}
    meta['exp_month'] || meta['expiry_month']
  end

  def exp_year
    meta = object.meta_data || {}
    meta['exp_year'] || meta['expiry_year']
  end

  private

  def normalize_usd_cents(value)
    return nil if value.nil?
    amount = value.to_d rescue nil
    return nil unless amount
    # Bridge stores USD limits in cents when >= 100000.
    amount > 100000 ? (amount / 100).to_f : amount.to_f
  end

  def admin_scope?
    scope.respond_to?(:admin?) && scope.admin?
  end
end
