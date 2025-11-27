# frozen_string_literal: true

class AddPaymentMethodToBillOrder < ActiveRecord::Migration[7.1]
  def change
    add_column :bill_orders, :payment_method, :integer, default: 0
  end
end
