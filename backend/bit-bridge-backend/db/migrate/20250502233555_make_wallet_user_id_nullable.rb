# frozen_string_literal: true

class MakeWalletUserIdNullable < ActiveRecord::Migration[7.1]
  def change
    change_column_null :wallets, :user_id, true
    change_column_null :bill_orders, :user_id, true
    change_column_null :user_profiles, :user_id, true
  end
end
