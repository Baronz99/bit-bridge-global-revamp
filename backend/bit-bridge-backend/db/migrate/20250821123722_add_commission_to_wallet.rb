# frozen_string_literal: true

class AddCommissionToWallet < ActiveRecord::Migration[7.1]
  def change
    add_column :wallets, :commission, :decimal
  end
end
