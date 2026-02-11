# frozen_string_literal: true

class AddBalanceSnapshotsToTransactions < ActiveRecord::Migration[7.1]
  def change
    add_column :transactions, :before_book_balance, :decimal, precision: 18, scale: 2
    add_column :transactions, :after_book_balance, :decimal, precision: 18, scale: 2
    add_column :transactions, :before_available_balance, :decimal, precision: 18, scale: 2
    add_column :transactions, :after_available_balance, :decimal, precision: 18, scale: 2
  end
end
