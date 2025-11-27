# frozen_string_literal: true

class CreateBankTransactions < ActiveRecord::Migration[7.1]
  def change
    create_table :bank_transactions, id: :uuid do |t|
      t.string :description
      t.decimal :amount
      t.string :recipient_id
      t.string :transaction_id
      t.references :account, null: false, foreign_key: true, type: :uuid

      t.timestamps
    end
  end
end
