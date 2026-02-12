# frozen_string_literal: true

class AddUniqueIndexForAnchorTransferUniqueTransactionId < ActiveRecord::Migration[7.1]
  disable_ddl_transaction!

  INDEX_NAME = 'idx_unique_anchor_transfer_component_per_wallet'

  def up
    return if index_exists?(:transactions, [:wallet_id, :unique_transaction_id], name: INDEX_NAME)

    add_index :transactions,
              [:wallet_id, :unique_transaction_id],
              unique: true,
              where: "unique_transaction_id IS NOT NULL AND metadata ->> 'provider' = 'anchor'",
              name: INDEX_NAME,
              algorithm: :concurrently
  end

  def down
    remove_index :transactions, name: INDEX_NAME if index_exists?(:transactions, [:wallet_id, :unique_transaction_id], name: INDEX_NAME)
  end
end
