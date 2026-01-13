# frozen_string_literal: true

class AddBridgecardFieldsToCardEvents < ActiveRecord::Migration[7.1]
  def change
    change_table :card_events, bulk: true do |t|
      t.string :provider_transaction_reference
      t.string :provider_card_id
      t.string :event_name
      t.string :event_status
      t.decimal :fee_amount, precision: 12, scale: 2
      t.string :fee_currency
      t.string :merchant_name
      t.jsonb :metadata
    end

    add_index :card_events,
              [:card_id, :provider_transaction_reference, :event_name],
              unique: true,
              name: 'index_card_events_on_provider_reference'
  end
end
