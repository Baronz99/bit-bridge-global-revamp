# frozen_string_literal: true

class TransactionRecord < ApplicationRecord
  belongs_to :exchange, class_name: 'Transaction', foreign_key: 'exchange_id', optional: true
  belongs_to :bill_order, optional: true
end
