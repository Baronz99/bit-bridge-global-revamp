# frozen_string_literal: true

class CreateCards < ActiveRecord::Migration[7.1]
  def change
    create_table :cards, id: :uuid do |t|
      t.string :cardholder_id
      t.string :card_id
      t.string :transaction_reference
      t.string :card_type
      t.string :card_brand
      t.string :card_currency
      t.decimal :card_limit
      t.decimal :funding_amount
      t.string :pin_encrypted
      t.string :status
      t.jsonb :meta_data
      t.references :user, null: false, foreign_key: true, type: :uuid

      t.timestamps
    end
  end
end
