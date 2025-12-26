# frozen_string_literal: true

class AddCurrencyAndBalanceToWallets < ActiveRecord::Migration[7.1]
  def change
    add_column :wallets, :currency, :string, default: 'NGN', null: false
    add_column :wallets, :balance_cents, :integer, default: 0, null: false

    add_index :wallets, %i[user_id wallet_type], unique: true
    add_index :wallets, %i[user_id currency]
  end
end
