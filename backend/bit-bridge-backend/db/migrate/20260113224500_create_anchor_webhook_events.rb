# frozen_string_literal: true

class CreateAnchorWebhookEvents < ActiveRecord::Migration[7.0]
  def change
    create_table :anchor_webhook_events do |t|
      t.string :event_type, null: false
      t.string :reference, null: false
      t.jsonb :payload, default: {}, null: false
      t.string :status, null: false, default: 'received'
      t.datetime :processed_at
      t.datetime :received_at
      t.string :error_message
      t.timestamps
    end

    add_index :anchor_webhook_events, %i[event_type reference], unique: true
    add_index :anchor_webhook_events, :received_at
  end
end
