# frozen_string_literal: true

class CreateWalletLedgerEntries < ActiveRecord::Migration[7.0]
  def change
    create_table :wallet_ledger_entries, id: :uuid do |t|
      t.uuid :wallet_id, null: false
      t.uuid :bill_order_id
      t.integer :entry_type, null: false
      t.decimal :amount, null: false
      t.string :reference
      t.jsonb :metadata, default: {}, null: false
      t.timestamps
    end

    add_index :wallet_ledger_entries, %i[wallet_id entry_type]
    add_index :wallet_ledger_entries, %i[bill_order_id entry_type],
              unique: true,
              where: "bill_order_id IS NOT NULL"
    add_foreign_key :wallet_ledger_entries, :wallets
    add_foreign_key :wallet_ledger_entries, :bill_orders
  end
end
