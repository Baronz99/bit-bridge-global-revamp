# frozen_string_literal: true

class TransactionSerializer < ActiveModel::Serializer
  attributes :id, :status, :amount, :created_at, :address, :bonus, :transaction_type, :proof_url, :email, :bank
  has_one :wallet
end
