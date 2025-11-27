# frozen_string_literal: true

class AddTypeColumnToWallet < ActiveRecord::Migration[7.1]
  def change
    add_column :wallets, :wallet_type, :integer, default: 0
  end
end
