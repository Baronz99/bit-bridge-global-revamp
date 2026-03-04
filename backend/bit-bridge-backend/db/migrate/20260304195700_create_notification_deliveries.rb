# frozen_string_literal: true

class CreateNotificationDeliveries < ActiveRecord::Migration[7.1]
  def change
    create_table :notification_deliveries, id: :uuid do |t|
      t.references :notification_event, null: false, foreign_key: true, type: :uuid
      t.references :notification_device, null: false, foreign_key: true, type: :uuid
      t.integer :status, null: false, default: 0
      t.integer :attempts, null: false, default: 0
      t.datetime :delivered_at
      t.datetime :failed_at
      t.string :provider_ticket_id
      t.text :error_message
      t.jsonb :provider_response, null: false, default: {}

      t.timestamps
    end

    add_index :notification_deliveries, %i[notification_event_id notification_device_id], unique: true, name: 'idx_notif_deliveries_event_device'
    add_index :notification_deliveries, :status
  end
end
