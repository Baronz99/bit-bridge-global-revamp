# frozen_string_literal: true

class AddServiceChargeColumnToBillOrder < ActiveRecord::Migration[7.1]
  def change
    add_column :bill_orders, :service_charge, :decimal, default: 0
  end
end
