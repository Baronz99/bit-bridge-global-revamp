# frozen_string_literal: true

class CreateBillPaymentIntents < ActiveRecord::Migration[7.1]
  def change
    create_table :bill_payment_intents, id: :uuid do |t|
      t.references :user, null: false, foreign_key: true, type: :uuid
      t.references :bill_order, null: true, foreign_key: true, type: :uuid
      t.string :bill_type, null: false
      t.decimal :amount, precision: 18, scale: 2, null: false
      t.decimal :fee, precision: 18, scale: 2, null: false, default: 0
      t.decimal :total, precision: 18, scale: 2, null: false
      t.integer :status, null: false, default: 0
      t.jsonb :metadata, null: false, default: {}
      t.string :provider_reference
      t.datetime :expires_at

      t.timestamps
    end

    add_index :bill_payment_intents, %i[user_id status]
    add_index :bill_payment_intents, :provider_reference
  end
end
