# frozen_string_literal: true

class AddProviderFieldsToWebhookEvents < ActiveRecord::Migration[7.1]
  disable_ddl_transaction!

  def up
    add_column :webhook_events, :provider, :string unless column_exists?(:webhook_events, :provider)
    add_column :webhook_events, :reference, :string unless column_exists?(:webhook_events, :reference)
    add_column :webhook_events, :provider_event_id, :string unless column_exists?(:webhook_events, :provider_event_id)
    add_column :webhook_events, :received_at, :datetime unless column_exists?(:webhook_events, :received_at)
    add_column :webhook_events, :signature_valid, :boolean, default: false, null: false unless column_exists?(:webhook_events, :signature_valid)
    add_column :webhook_events, :processing_status, :string, default: 'received', null: false unless column_exists?(:webhook_events, :processing_status)

    execute <<~SQL
      UPDATE webhook_events
      SET provider = COALESCE(provider, source)
      WHERE provider IS NULL
    SQL

    execute <<~SQL
      UPDATE webhook_events
      SET received_at = COALESCE(received_at, created_at)
      WHERE received_at IS NULL
    SQL

    add_index :webhook_events,
              %i[provider event_type reference],
              unique: true,
              where: "reference IS NOT NULL AND reference <> ''",
              algorithm: :concurrently,
              name: 'idx_webhook_events_provider_event_ref_unique' unless index_exists?(:webhook_events, %i[provider event_type reference], name: 'idx_webhook_events_provider_event_ref_unique')

    add_index :webhook_events,
              %i[provider provider_event_id],
              unique: true,
              where: "provider_event_id IS NOT NULL AND provider_event_id <> ''",
              algorithm: :concurrently,
              name: 'idx_webhook_events_provider_event_id_unique' unless index_exists?(:webhook_events, %i[provider provider_event_id], name: 'idx_webhook_events_provider_event_id_unique')

    add_index :webhook_events, :processing_status, algorithm: :concurrently unless index_exists?(:webhook_events, :processing_status)
    add_index :webhook_events, :received_at, algorithm: :concurrently unless index_exists?(:webhook_events, :received_at)
  end

  def down
    remove_index :webhook_events, name: 'idx_webhook_events_provider_event_ref_unique' if index_exists?(:webhook_events, name: 'idx_webhook_events_provider_event_ref_unique')
    remove_index :webhook_events, name: 'idx_webhook_events_provider_event_id_unique' if index_exists?(:webhook_events, name: 'idx_webhook_events_provider_event_id_unique')
    remove_index :webhook_events, :processing_status if index_exists?(:webhook_events, :processing_status)
    remove_index :webhook_events, :received_at if index_exists?(:webhook_events, :received_at)

    remove_column :webhook_events, :processing_status if column_exists?(:webhook_events, :processing_status)
    remove_column :webhook_events, :signature_valid if column_exists?(:webhook_events, :signature_valid)
    remove_column :webhook_events, :received_at if column_exists?(:webhook_events, :received_at)
    remove_column :webhook_events, :provider_event_id if column_exists?(:webhook_events, :provider_event_id)
    remove_column :webhook_events, :reference if column_exists?(:webhook_events, :reference)
    remove_column :webhook_events, :provider if column_exists?(:webhook_events, :provider)
  end
end
