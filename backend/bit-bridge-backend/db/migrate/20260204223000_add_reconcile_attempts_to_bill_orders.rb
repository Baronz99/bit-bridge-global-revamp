# frozen_string_literal: true

class AddReconcileAttemptsToBillOrders < ActiveRecord::Migration[7.1]
  def change
    add_column :bill_orders, :reconcile_attempts, :integer, null: false, default: 0
    add_column :bill_orders, :reconcile_last_attempt_at, :datetime
  end
end
