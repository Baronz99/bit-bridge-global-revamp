# frozen_string_literal: true

class AddTransactionPinAppLockEnabledToUsers < ActiveRecord::Migration[7.0]
  def change
    add_column :users, :transaction_pin_app_lock_enabled, :boolean, default: false, null: false
  end
end
