# frozen_string_literal: true

class CreateCardEvents < ActiveRecord::Migration[7.1]
  def change
    create_table :card_events, id: :uuid do |t|
      t.string :event, null: false
      t.string :status
      t.string :card_id
      t.string :cardholder_id
      t.string :currency
      t.decimal :amount, precision: 12, scale: 2
      t.string :transaction_reference
      t.string :card_transaction_type
      t.string :merchant_category_code
      t.string :description
      t.string :decline_reason
      t.datetime :transaction_at
      t.boolean :livemode
      t.jsonb :raw_payload
      t.references :user, type: :uuid, null: true, foreign_key: true

      t.timestamps
    end

    add_index :card_events, :card_id
    add_index :card_events, :transaction_reference
    add_index :card_events, :event
    add_index :card_events, :transaction_at
  end
end
