# frozen_string_literal: true

class CreateNotificationDevices < ActiveRecord::Migration[7.1]
  def change
    create_table :notification_devices, id: :uuid do |t|
      t.references :user, null: false, foreign_key: true, type: :uuid
      t.string :provider, null: false, default: 'expo'
      t.string :token, null: false
      t.string :platform
      t.string :app_version
      t.boolean :active, null: false, default: true
      t.datetime :last_seen_at
      t.jsonb :metadata, null: false, default: {}

      t.timestamps
    end

    add_index :notification_devices, %i[provider token], unique: true
    add_index :notification_devices, %i[user_id active]
  end
end
