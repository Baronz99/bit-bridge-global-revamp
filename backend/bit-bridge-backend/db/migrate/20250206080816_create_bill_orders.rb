# frozen_string_literal: true

class CreateBillOrders < ActiveRecord::Migration[7.1]
  def change
    create_table :bill_orders, id: :uuid do |t|
      t.integer :status, default: 0
      t.string :meter_number
      t.decimal :amount
      t.decimal :total_amount
      t.integer :meter_type, default: 0
      t.string :phone
      t.string :biller
      t.string :service_type
      t.integer :payment_type, default: 0
      t.string :email
      t.string :tariff_class
      t.string :name

      t.references :order_detail, null: true, foreign_key: true, type: :uuid
      t.timestamps
    end
  end
end
