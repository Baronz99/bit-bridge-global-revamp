# frozen_string_literal: true

class UpdateFxQuotesPrecisionAndRawFields < ActiveRecord::Migration[7.0]
  def change
    change_column :fx_quotes, :base_rate, :decimal, precision: 24, scale: 12
    change_column :fx_quotes, :markup, :decimal, precision: 24, scale: 12
    change_column :fx_quotes, :execution_rate, :decimal, precision: 24, scale: 12
    change_column :fx_quotes, :fee_amount, :decimal, precision: 24, scale: 6
    change_column :fx_quotes, :amount_in, :decimal, precision: 24, scale: 6
    change_column :fx_quotes, :amount_after_fee, :decimal, precision: 24, scale: 6
    change_column :fx_quotes, :amount_out, :decimal, precision: 24, scale: 6

    add_column :fx_quotes, :base_rate_raw, :decimal, precision: 24, scale: 12
    add_column :fx_quotes, :markup_raw, :decimal, precision: 24, scale: 12
    add_column :fx_quotes, :execution_rate_raw, :decimal, precision: 24, scale: 12
    add_column :fx_quotes, :fee_amount_raw, :decimal, precision: 24, scale: 12
    add_column :fx_quotes, :amount_in_raw, :decimal, precision: 24, scale: 12
    add_column :fx_quotes, :amount_after_fee_raw, :decimal, precision: 24, scale: 12
    add_column :fx_quotes, :amount_out_raw, :decimal, precision: 24, scale: 12
  end
end
