# frozen_string_literal: true

class TransactionSerializer < ActiveModel::Serializer
  attributes :id,
             :status,
             :amount,
             :currency,
             :created_at,
             :address,
             :bonus,
             :transaction_type,
             :coin_type,
             :proof_url,
             :email,
             :bank,
             :wallet_id,
             :bridge_card_id,
             :wallet_type

  def wallet_type
    object.wallet&.wallet_type
  end

  def currency
    value =
      if object.respond_to?(:has_attribute?) && object.has_attribute?(:currency)
        object[:currency]
      end

    value = value.presence || object.wallet&.currency
    return value if value.present?

    return 'USD' if object.wallet&.usd?
    return 'NGN' if object.wallet&.ngn?

    nil
  end

  has_one :wallet
end
