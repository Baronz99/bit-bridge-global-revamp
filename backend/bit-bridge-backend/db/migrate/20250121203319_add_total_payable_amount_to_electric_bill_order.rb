# frozen_string_literal: true

class AddTotalPayableAmountToElectricBillOrder < ActiveRecord::Migration[7.1]
  def change
    add_column :electric_bill_orders, :total_amount, :decimal
  end
end
