# frozen_string_literal: true

class RemoveUserForeignKeyFromWallets < ActiveRecord::Migration[7.1]
  def change
    remove_foreign_key :wallets, :users
  end
end
