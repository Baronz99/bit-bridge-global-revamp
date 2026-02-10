# frozen_string_literal: true

class AddBalanceSnapshotsToWalletLedgerEntries < ActiveRecord::Migration[7.1]
  def change
    add_column :wallet_ledger_entries, :before_book_balance, :decimal, precision: 18, scale: 2
    add_column :wallet_ledger_entries, :after_book_balance, :decimal, precision: 18, scale: 2
    add_column :wallet_ledger_entries, :before_available_balance, :decimal, precision: 18, scale: 2
    add_column :wallet_ledger_entries, :after_available_balance, :decimal, precision: 18, scale: 2
  end
end
