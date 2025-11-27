# frozen_string_literal: true

class AddAccountRefToTransaction < ActiveRecord::Migration[7.1]
  def change
    add_reference :transactions, :account, null: true, foreign_key: true, type: :uuid
    add_column :transactions, :unique_transaction_id, :string
    add_column :transactions, :transfer_id, :string
  end
end
