class AddRewardFieldsToBillOrders < ActiveRecord::Migration[7.1]
  def change
    add_column :bill_orders, :reward_applied, :decimal, precision: 15, scale: 2, default: 0, null: false
    add_column :bill_orders, :wallet_amount_charged, :decimal, precision: 15, scale: 2, default: 0, null: false
  end
end
