# frozen_string_literal: true

class CreateNotificationEvents < ActiveRecord::Migration[7.1]
  def change
    create_table :notification_events, id: :uuid do |t|
      t.references :user, null: false, foreign_key: true, type: :uuid
      t.string :event_type, null: false
      t.string :resource_type, null: false
      t.string :resource_id, null: false
      t.string :reference
      t.string :state, null: false
      t.string :title, null: false
      t.text :body, null: false
      t.string :deeplink
      t.string :priority, null: false, default: 'normal'
      t.string :idempotency_key, null: false
      t.datetime :occurred_at, null: false
      t.integer :status, null: false, default: 0
      t.integer :attempts, null: false, default: 0
      t.text :error_message
      t.jsonb :metadata, null: false, default: {}

      t.timestamps
    end

    add_index :notification_events, :idempotency_key, unique: true
    add_index :notification_events, %i[user_id created_at]
    add_index :notification_events, :status
  end
end
