# frozen_string_literal: true

class WalletSerializer < ActiveModel::Serializer
  attributes :id, :wallet_type, :balance, :commission, :total_bills, :withdrawn, :total_deposit

  has_one :user
  has_many :transactions
end
