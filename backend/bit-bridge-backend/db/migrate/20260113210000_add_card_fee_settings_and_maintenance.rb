# frozen_string_literal: true

class AddCardFeeSettingsAndMaintenance < ActiveRecord::Migration[7.0]
  def change
    change_table :fx_settings, bulk: true do |t|
      t.integer :card_monthly_maintenance_fee_usd_cents, default: 0, null: false
      t.integer :card_funding_fee_bps, default: 0, null: false
      t.integer :card_funding_fee_cap_usd_cents, default: 0, null: false
      t.integer :card_withdrawal_fee_bps, default: 0, null: false
      t.integer :card_withdrawal_fee_cap_usd_cents, default: 0, null: false
    end

    add_column :cards, :last_maintenance_fee_charged_at, :datetime
  end
end
