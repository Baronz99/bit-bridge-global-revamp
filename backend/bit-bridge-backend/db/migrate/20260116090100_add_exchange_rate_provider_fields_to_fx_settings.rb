# frozen_string_literal: true

class AddExchangeRateProviderFieldsToFxSettings < ActiveRecord::Migration[7.1]
  def change
    change_table :fx_settings, bulk: true do |t|
      t.string :provider_base, default: 'USD', null: false
      t.jsonb :provider_rates, default: {}
      t.string :provider_as_of
      t.string :provider_error
      t.datetime :provider_next_refresh_at
      t.jsonb :base_fx_rates, default: {}
    end
  end
end
