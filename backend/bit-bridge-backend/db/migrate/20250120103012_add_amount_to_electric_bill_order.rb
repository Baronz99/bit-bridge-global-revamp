# frozen_string_literal: true

class AddAmountToElectricBillOrder < ActiveRecord::Migration[7.1]
  def change
    add_column :electric_bill_orders, :amount, :decimal
  end
end
