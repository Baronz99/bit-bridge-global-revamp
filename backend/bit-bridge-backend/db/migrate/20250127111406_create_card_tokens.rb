# frozen_string_literal: true

class CreateCardTokens < ActiveRecord::Migration[7.1]
  def change
    create_table :card_tokens, id: :uuid do |t|
      t.boolean :reveal, default: false
      t.references :order_item, null: false, foreign_key: true, type: :uuid
      t.string :token

      t.timestamps
    end
  end
end
