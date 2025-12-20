# frozen_string_literal: true

class AddTransactionPinToUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :transaction_pin_digest, :string
    add_column :users, :transaction_pin_set_at, :datetime

    # optional but strongly recommended (basic anti-bruteforce)
    add_column :users, :transaction_pin_attempts, :integer, default: 0, null: false
    add_column :users, :transaction_pin_locked_until, :datetime
  end
end
