# frozen_string_literal: true

class CreateTransactionRecords < ActiveRecord::Migration[7.1]
  def change
    create_table :transaction_records, id: :uuid do |t|
      t.string :transaction_id
      t.string :status
      t.string :customer_name
      t.string :email
      t.string :reference
      t.string :event_type
      t.decimal :amount

      t.timestamps
    end
  end
end
