# frozen_string_literal: true

class AddAddressToBillOrder < ActiveRecord::Migration[7.1]
  def change
    add_column :bill_orders, :address, :string
    add_column :bill_orders, :units, :string
    add_column :bill_orders, :transaction_id, :string
  end
end
