# frozen_string_literal: true

class AddCommissionUsedToBillOrders < ActiveRecord::Migration[7.1]
  def change
    add_column :bill_orders, :commission_used, :decimal, precision: 18, scale: 2, default: 0, null: false
  end
end
