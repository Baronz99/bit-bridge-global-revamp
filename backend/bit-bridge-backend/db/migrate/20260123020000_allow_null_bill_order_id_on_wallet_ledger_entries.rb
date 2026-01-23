# frozen_string_literal: true

class AllowNullBillOrderIdOnWalletLedgerEntries < ActiveRecord::Migration[7.1]
  def change
    change_column_null :wallet_ledger_entries, :bill_order_id, true
  end
end
