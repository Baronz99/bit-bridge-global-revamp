# frozen_string_literal: true

class AddFxDiscoveryFieldsToCardEvents < ActiveRecord::Migration[7.0]
  def change
    add_column :card_events, :merchant_amount, :decimal, precision: 18, scale: 6
    add_column :card_events, :merchant_currency, :string
    add_column :card_events, :billing_amount, :decimal, precision: 18, scale: 6
    add_column :card_events, :billing_currency, :string
    add_column :card_events, :fx_implied_rate, :decimal, precision: 18, scale: 6
    add_column :card_events, :fx_reference_rate, :decimal, precision: 18, scale: 6
    add_column :card_events, :fx_margin_usd, :decimal, precision: 18, scale: 6
    add_column :card_events, :fx_markup_usd, :decimal, precision: 18, scale: 6
  end
end
