# frozen_string_literal: true

class CreateTransactions < ActiveRecord::Migration[7.1]
  def change
    create_table :transactions, id: :uuid do |t|
      t.integer :status, default: 0
      t.decimal :amount
      t.string :address
      t.integer :transaction_type, default: 0
      t.references :wallet, null: false, foreign_key: true, type: :uuid

      t.timestamps
    end
  end
end
