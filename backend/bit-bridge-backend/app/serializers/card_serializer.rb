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

  attribute :provider_status, if: :admin_scope?
  attribute :provider_updated_at, if: :admin_scope?
  attribute :provider_livemode, if: :admin_scope?
  attribute :status_last_refreshed_at, if: :admin_scope?
  attribute :internal_status, if: :admin_scope?
  attribute :bridgecard_env, if: :admin_scope?

  has_one :user

  def card_id
    object.card_id
  end

  def cardholder_id
    object.cardholder_id
  end

  def transaction_reference
    object.transaction_reference
  end

  def card_type
    object.card_type
  end

  def card_limit
    object.card_limit
  end

  def funding_amount
    return object.funding_amount if object.respond_to?(:funding_amount)

    object.respond_to?(:amount) ? object.amount : nil
  end

  def meta_data
    object.meta_data
  end

  def card_limit_usd
    normalize_usd_cents(object.card_limit)
  end

  def funding_amount_usd
    amount = funding_amount
    normalize_usd_cents(amount)
  end

  def card_last4
    meta = object.meta_data || {}
    meta['last4'] ||
      meta['last_4'] ||
      meta['pan_last4'] ||
      meta['card_last4']
  end

  def exp_month
    meta = object.meta_data || {}
    meta['exp_month'] || meta['expiry_month']
  end

  def exp_year
    meta = object.meta_data || {}
    meta['exp_year'] || meta['expiry_year']
  end

  def provider_livemode
    object.provider_livemode
  end

  def status_last_refreshed_at
    object.provider_updated_at
  end

  def internal_status
    object.status
  end

  def bridgecard_env
    Bridgecard::Config.env_name
  end

  def admin_scope?
    scope.respond_to?(:admin?) && scope.admin?
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
