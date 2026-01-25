class AddIdempotencyFieldsToCircleTransactions < ActiveRecord::Migration[7.1]
  def change
    add_column :circle_transactions, :idempotency_key, :string
    add_column :circle_transactions, :request_id, :string
    add_column :circle_transactions, :event_type, :string
    add_column :circle_transactions, :wallet_transaction_id, :uuid

    add_index :circle_transactions,
              %i[circle_id idempotency_key],
              unique: true,
              where: 'idempotency_key IS NOT NULL',
              name: 'index_circle_transactions_on_circle_id_and_idempotency_key'
    add_index :circle_transactions, :wallet_transaction_id
    add_foreign_key :circle_transactions, :transactions, column: :wallet_transaction_id
  end
end
