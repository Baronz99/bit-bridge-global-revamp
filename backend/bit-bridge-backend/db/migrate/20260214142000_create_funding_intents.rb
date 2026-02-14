class CreateFundingIntents < ActiveRecord::Migration[7.1]
  def change
    create_table :funding_intents, id: :uuid do |t|
      t.references :user, null: false, type: :uuid, foreign_key: true
      t.string :provider, null: false, default: 'anchor'
      t.string :reference, null: false
      t.bigint :expected_amount_cents
      t.datetime :expires_at, null: false
      t.string :status, null: false, default: 'pending'
      t.jsonb :metadata, null: false, default: {}
      t.references :credited_transaction, type: :uuid, foreign_key: { to_table: :transactions }

      t.timestamps
    end

    add_index :funding_intents, :reference, unique: true
    add_index :funding_intents, %i[user_id status]
    add_index :funding_intents, :expires_at
  end
end
