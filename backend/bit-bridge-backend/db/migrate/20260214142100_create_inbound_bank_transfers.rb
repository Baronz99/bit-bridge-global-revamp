class CreateInboundBankTransfers < ActiveRecord::Migration[7.1]
  def change
    create_table :inbound_bank_transfers, id: :uuid do |t|
      t.string :provider, null: false, default: 'anchor'
      t.string :provider_reference, null: false
      t.bigint :amount_cents, null: false
      t.string :currency, null: false, default: 'NGN'
      t.string :sender_name
      t.text :narration
      t.datetime :received_at
      t.string :status, null: false, default: 'unmatched'
      t.references :matched_user, type: :uuid, foreign_key: { to_table: :users }
      t.references :funding_intent, type: :uuid, foreign_key: true
      t.references :credited_transaction, type: :uuid, foreign_key: { to_table: :transactions }
      t.jsonb :raw_payload, null: false, default: {}

      t.timestamps
    end

    add_index :inbound_bank_transfers,
              %i[provider provider_reference],
              unique: true,
              name: 'index_inbound_bank_transfers_on_provider_and_provider_reference'
    add_index :inbound_bank_transfers, :status
  end
end

