# frozen_string_literal: true

class AddUserForeignKeyToWalletsWithNullify < ActiveRecord::Migration[7.1]
  def change
    add_foreign_key :wallets, :users, on_delete: :nullify
  end
end
