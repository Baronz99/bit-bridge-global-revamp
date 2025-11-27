# frozen_string_literal: true

class AddTokenToElectricBillOrder < ActiveRecord::Migration[7.1]
  def change
    add_column :electric_bill_orders, :token, :string
  end
end
