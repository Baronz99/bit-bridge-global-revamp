# frozen_string_literal: true

class AddTransactionPinLockFieldsToUsers < ActiveRecord::Migration[7.1]
  def change
    unless column_exists?(:users, :transaction_pin_attempts)
      add_column :users, :transaction_pin_attempts, :integer, null: false, default: 0
    end

    unless column_exists?(:users, :transaction_pin_locked_until)
      add_column :users, :transaction_pin_locked_until, :datetime
    end

    unless index_exists?(:users, :transaction_pin_locked_until)
      add_index :users, :transaction_pin_locked_until
    end
  end
end
