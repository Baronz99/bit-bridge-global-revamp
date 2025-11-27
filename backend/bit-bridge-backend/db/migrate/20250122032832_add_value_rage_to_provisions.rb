# frozen_string_literal: true

class AddValueRageToProvisions < ActiveRecord::Migration[7.1]
  def change
    add_column :provisions, :value_range, :decimal, array: true, default: []
  end
end
