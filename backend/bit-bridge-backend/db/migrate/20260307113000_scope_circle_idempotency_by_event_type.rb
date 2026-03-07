class ScopeCircleIdempotencyByEventType < ActiveRecord::Migration[7.1]
  def change
    remove_index :circle_transactions,
                 name: 'index_circle_transactions_on_circle_id_and_idempotency_key',
                 if_exists: true

    add_index :circle_transactions,
              %i[circle_id event_type idempotency_key],
              unique: true,
              where: '(idempotency_key IS NOT NULL)',
              name: 'idx_circle_tx_circle_event_idempotency'
  end
end
