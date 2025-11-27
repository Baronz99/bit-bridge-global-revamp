# frozen_string_literal: true

class CreateOrderDetails < ActiveRecord::Migration[7.1]
  def change
    create_table :order_details, id: :uuid do |t|
      t.decimal :total_amount
      t.integer :status, default: 0
      t.integer :payment_method, default: 0
      t.boolean :viewed, default: 0
      t.decimal :net_total

      t.references :user, null: false, foreign_key: true, type: :uuid

      t.timestamps
    end
  end
end
