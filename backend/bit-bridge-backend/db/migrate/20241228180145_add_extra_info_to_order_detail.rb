# frozen_string_literal: true

class AddExtraInfoToOrderDetail < ActiveRecord::Migration[7.1]
  def change
    add_column :order_details, :extra_info, :text
  end
end
