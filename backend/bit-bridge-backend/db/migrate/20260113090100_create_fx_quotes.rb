# frozen_string_literal: true

class CreateFxQuotes < ActiveRecord::Migration[7.0]
  def change
    create_table :fx_quotes do |t|
      t.string  :token, null: false
      t.string  :direction, null: false
      t.decimal :base_rate, precision: 12, scale: 4, null: false
      t.decimal :markup, precision: 12, scale: 4, null: false
      t.decimal :execution_rate, precision: 12, scale: 4, null: false
      t.decimal :fee_amount, precision: 18, scale: 6, null: false
      t.string  :fee_currency, null: false
      t.decimal :amount_in, precision: 18, scale: 6, null: false
      t.decimal :amount_after_fee, precision: 18, scale: 6, null: false
      t.decimal :amount_out, precision: 18, scale: 6, null: false
      t.datetime :expires_at, null: false
      t.references :user, null: false, foreign_key: true, type: :uuid

      t.timestamps
    end

    add_index :fx_quotes, :token, unique: true
    add_index :fx_quotes, :expires_at
  end
end
