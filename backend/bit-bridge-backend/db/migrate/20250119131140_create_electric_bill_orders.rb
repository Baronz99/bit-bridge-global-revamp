# frozen_string_literal: true

class CreateElectricBillOrders < ActiveRecord::Migration[7.1]
  def change
    create_table :electric_bill_orders, id: :uuid do |t|
      t.string :meter_number
      t.string :meter_type
      t.string :meter_address
      t.string :customer_name
      t.string :email
      t.string :request_id
      t.string :phone
      t.string :serviceID

      t.references :order_detail, null: true, foreign_key: true, type: :uuid

      t.timestamps
    end
  end
end
