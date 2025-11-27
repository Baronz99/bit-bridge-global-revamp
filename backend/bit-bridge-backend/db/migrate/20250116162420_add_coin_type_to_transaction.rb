# frozen_string_literal: true

class AddCoinTypeToTransaction < ActiveRecord::Migration[7.1]
  def change
    add_column :transactions, :coin_type, :integer, default: 0
  end
end
