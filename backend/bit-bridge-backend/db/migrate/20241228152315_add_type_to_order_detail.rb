# frozen_string_literal: true

class AddTypeToOrderDetail < ActiveRecord::Migration[7.1]
  def change
    add_column :order_details, :type, :integer, default: 0
  end
end
