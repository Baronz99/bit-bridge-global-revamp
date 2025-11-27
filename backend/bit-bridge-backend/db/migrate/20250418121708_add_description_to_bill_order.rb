# frozen_string_literal: true

class AddDescriptionToBillOrder < ActiveRecord::Migration[7.1]
  def change
    add_column :bill_orders, :description, :string
  end
end
