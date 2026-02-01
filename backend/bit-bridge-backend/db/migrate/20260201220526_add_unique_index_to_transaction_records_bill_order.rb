class AddUniqueIndexToTransactionRecordsBillOrder < ActiveRecord::Migration[7.1]
  disable_ddl_transaction!

  NAME = 'idx_tr_unique_bill_payment_per_bill_order'.freeze

  def up
    add_index :transaction_records,
              :bill_order_id,
              unique: true,
              where: "bill_order_id IS NOT NULL AND event_type = 'bill_payment'",
              algorithm: :concurrently,
              name: NAME
  end

  def down
    remove_index :transaction_records, name: NAME
  end
end
