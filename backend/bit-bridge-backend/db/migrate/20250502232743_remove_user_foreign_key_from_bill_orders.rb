# frozen_string_literal: true

class RemoveUserForeignKeyFromBillOrders < ActiveRecord::Migration[7.1]
  def change
    remove_foreign_key :bill_orders, :users
  end
end
