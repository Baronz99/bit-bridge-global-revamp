# frozen_string_literal: true

class AddUsdAmountToBillOrders < ActiveRecord::Migration[7.1]
  def change
    add_column :bill_orders, :usd_amount, :decimal
  end
end
