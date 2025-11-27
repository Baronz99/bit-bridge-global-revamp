# frozen_string_literal: true

class AddValueToProvision < ActiveRecord::Migration[7.1]
  def change
    add_column :provisions, :value, :decimal
    add_column :provisions, :description, :text
    add_column :provisions, :currency, :integer, default: 0
  end
end
