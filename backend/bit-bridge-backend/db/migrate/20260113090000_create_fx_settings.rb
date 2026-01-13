# frozen_string_literal: true

class CreateFxSettings < ActiveRecord::Migration[7.0]
  def change
    create_table :fx_settings do |t|
      t.decimal :base_usd_ngn_rate, precision: 12, scale: 4, null: false, default: 1490

      t.timestamps
    end
  end
end
