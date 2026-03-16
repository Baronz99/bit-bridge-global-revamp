class CreateServiceStatusSubscriptions < ActiveRecord::Migration[7.1]
  def change
    create_table :service_status_subscriptions, id: :uuid do |t|
      t.references :user, null: false, foreign_key: true, type: :uuid
      t.string :provider, null: false
      t.string :service_key, null: false
      t.string :channel, null: false, default: 'push'
      t.boolean :active, null: false, default: true
      t.string :last_notified_state
      t.datetime :last_notified_at
      t.datetime :expires_at
      t.jsonb :metadata, null: false, default: {}

      t.timestamps
    end

    add_index :service_status_subscriptions,
              %i[user_id provider service_key channel],
              unique: true,
              name: 'idx_service_status_subscriptions_uniqueness'
    add_index :service_status_subscriptions,
              %i[provider service_key active],
              name: 'idx_service_status_subscriptions_lookup'
  end
end
