# frozen_string_literal: true

class AddProviderFxFieldsToFxSettings < ActiveRecord::Migration[7.1]
  def change
    change_table :fx_settings, bulk: true do |t|
      t.decimal :provider_usd_ngn_rate, precision: 18, scale: 6
      t.bigint :provider_raw
      t.string :provider_source, default: 'bridgecard', null: false
      t.integer :provider_fx_divisor, default: 100, null: false
      t.datetime :provider_updated_at
    end
  end
end
