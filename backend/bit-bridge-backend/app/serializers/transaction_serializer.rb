# frozen_string_literal: true

class TransactionSerializer < ActiveModel::Serializer
  attributes :id,
             :status,
             :amount,
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

  has_one :wallet
end
