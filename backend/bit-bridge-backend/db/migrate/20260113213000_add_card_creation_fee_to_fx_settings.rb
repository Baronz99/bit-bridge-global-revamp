# frozen_string_literal: true

class AddCardCreationFeeToFxSettings < ActiveRecord::Migration[7.0]
  def change
    add_column :fx_settings, :card_creation_fee_usd_cents, :integer, default: 400, null: false
  end
end
