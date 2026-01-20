# frozen_string_literal: true

class AddUniqueWalletLedgerLogicalIndex < ActiveRecord::Migration[7.0]
  def up
    execute <<~SQL.squish
      DELETE FROM wallet_ledger_entries a
      USING wallet_ledger_entries b
      WHERE a.id < b.id
        AND a.wallet_id = b.wallet_id
        AND a.bill_order_id = b.bill_order_id
        AND a.entry_type = b.entry_type
    SQL

    add_index :wallet_ledger_entries,
              %i[wallet_id bill_order_id entry_type],
              unique: true,
              name: "idx_unique_wallet_ledger_logical_entry"
  end

  def down
    remove_index :wallet_ledger_entries, name: "idx_unique_wallet_ledger_logical_entry"
  end
end
