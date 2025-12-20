# frozen_string_literal: true

class AddTransactionPinLockFieldsToUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :transaction_pin_attempts, :integer, null: false, default: 0
    add_column :users, :transaction_pin_locked_until, :datetime
    add_index  :users, :transaction_pin_locked_until
  end
end
