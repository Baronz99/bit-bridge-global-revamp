# frozen_string_literal: true

class BankTransactionSerializer < ActiveModel::Serializer
  attributes :id, :description, :amount, :recipient_id, :trasaction_id
  has_one :account
end
