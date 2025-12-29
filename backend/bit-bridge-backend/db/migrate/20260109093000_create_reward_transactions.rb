# frozen_string_literal: true

class CreateRewardTransactions < ActiveRecord::Migration[7.1]
  def change
    create_table :reward_transactions, id: :uuid do |t|
      t.references :user, null: false, foreign_key: true, type: :uuid
      t.references :bill_order, null: true, foreign_key: true, type: :uuid
      t.decimal :amount, precision: 12, scale: 2, null: false
      t.decimal :source_amount, precision: 12, scale: 2
      t.decimal :reward_rate, precision: 6, scale: 4, null: false, default: 0.01
      t.string :currency, null: false, default: 'NGN'
      t.string :service_type
      t.string :source_label
      t.integer :status, null: false, default: 1
      t.datetime :earned_at

      t.timestamps
    end

    add_index :reward_transactions, :earned_at
  end
end
