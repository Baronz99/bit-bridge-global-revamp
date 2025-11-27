# frozen_string_literal: true

class CreateOrderItems < ActiveRecord::Migration[7.1]
  def change
    create_table :order_items, id: :uuid do |t|
      t.integer :quantity, default: 1
      t.decimal :amount
      t.references :product, null: false, foreign_key: true, type: :uuid
      t.references :order_detail, null: false, foreign_key: true, type: :uuid

      t.timestamps
    end
  end
end
