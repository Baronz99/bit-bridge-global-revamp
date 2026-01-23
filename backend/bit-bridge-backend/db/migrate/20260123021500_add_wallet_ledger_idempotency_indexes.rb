# frozen_string_literal: true

class AddWalletLedgerIdempotencyIndexes < ActiveRecord::Migration[7.1]
  disable_ddl_transaction!

  def up
    add_bill_order_entry_index
    add_reference_entry_index
  end

  def down
    remove_index :wallet_ledger_entries, name: 'idx_wallet_ledger_unique_bill_order_entry_partial' if index_exists?(:wallet_ledger_entries, name: 'idx_wallet_ledger_unique_bill_order_entry_partial')
    remove_index :wallet_ledger_entries, name: 'idx_wallet_ledger_unique_reference_entry' if index_exists?(:wallet_ledger_entries, name: 'idx_wallet_ledger_unique_reference_entry')
  end

  private

  def add_bill_order_entry_index
    return if index_exists?(:wallet_ledger_entries, name: 'idx_wallet_ledger_unique_bill_order_entry_partial')

    if duplicates_for_bill_order_index?
      say 'Skipping wallet_ledger_entries bill_order idempotency index due to duplicates. See runbook query.', true
      return
    end

    add_index :wallet_ledger_entries,
              %i[wallet_id bill_order_id entry_type],
              unique: true,
              where: 'bill_order_id IS NOT NULL',
              name: 'idx_wallet_ledger_unique_bill_order_entry_partial',
              algorithm: :concurrently
  end

  def add_reference_entry_index
    return if index_exists?(:wallet_ledger_entries, name: 'idx_wallet_ledger_unique_reference_entry')

    if duplicates_for_reference_index?
      say 'Skipping wallet_ledger_entries reference idempotency index due to duplicates. See runbook query.', true
      return
    end

    add_index :wallet_ledger_entries,
              %i[wallet_id entry_type reference],
              unique: true,
              where: 'reference IS NOT NULL',
              name: 'idx_wallet_ledger_unique_reference_entry',
              algorithm: :concurrently
  end

  def duplicates_for_bill_order_index?
    sql = <<~SQL
      SELECT 1
      FROM wallet_ledger_entries
      WHERE bill_order_id IS NOT NULL
      GROUP BY wallet_id, bill_order_id, entry_type
      HAVING COUNT(*) > 1
      LIMIT 1
    SQL
    ActiveRecord::Base.connection.select_value(sql).present?
  end

  def duplicates_for_reference_index?
    sql = <<~SQL
      SELECT 1
      FROM wallet_ledger_entries
      WHERE reference IS NOT NULL
      GROUP BY wallet_id, entry_type, reference
      HAVING COUNT(*) > 1
      LIMIT 1
    SQL
    ActiveRecord::Base.connection.select_value(sql).present?
  end
end
