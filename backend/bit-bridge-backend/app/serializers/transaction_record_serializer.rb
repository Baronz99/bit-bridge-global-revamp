# frozen_string_literal: true

class TransactionRecordSerializer < ActiveModel::Serializer
  attributes :id, :transaction_id, :exchange_id, :bill_order_id, :reference
end
