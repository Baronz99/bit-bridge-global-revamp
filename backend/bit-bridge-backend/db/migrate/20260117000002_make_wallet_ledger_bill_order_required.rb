# frozen_string_literal: true

class MakeWalletLedgerBillOrderRequired < ActiveRecord::Migration[7.0]
  def up
    null_count = select_value("SELECT COUNT(*) FROM wallet_ledger_entries WHERE bill_order_id IS NULL").to_i
    if null_count.positive?
      say "Deleting #{null_count} wallet_ledger_entries rows with NULL bill_order_id"
      execute("DELETE FROM wallet_ledger_entries WHERE bill_order_id IS NULL")
    end

    change_column_null :wallet_ledger_entries, :bill_order_id, false
  end

  def down
    change_column_null :wallet_ledger_entries, :bill_order_id, true
  end
end
