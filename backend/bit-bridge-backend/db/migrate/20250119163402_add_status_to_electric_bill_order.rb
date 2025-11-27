# frozen_string_literal: true

class AddStatusToElectricBillOrder < ActiveRecord::Migration[7.1]
  def change
    add_column :electric_bill_orders, :status, :integer, default: 0
    add_column :electric_bill_orders, :transaction_id, :string
  end
end
