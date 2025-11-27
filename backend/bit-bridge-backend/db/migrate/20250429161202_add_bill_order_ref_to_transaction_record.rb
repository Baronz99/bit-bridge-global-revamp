# frozen_string_literal: true

class AddBillOrderRefToTransactionRecord < ActiveRecord::Migration[7.1]
  def change
    add_reference :transaction_records, :bill_order, null: true, foreign_key: true, type: :uuid
    add_reference :transaction_records, :exchange, null: true, foreign_key: { to_table: :transactions }, type: :uuid
  end
end
