class CreateWebhookEvents < ActiveRecord::Migration[7.1]
  def change
    unless table_exists?(:webhook_events)
      create_table :webhook_events, id: :uuid do |t|
        t.string :source, null: false
        t.string :event_type
        t.jsonb :headers
        t.jsonb :payload
        t.jsonb :payload_json
        t.datetime :processed_at
        t.string :processing_error
        t.timestamps
      end

      add_index :webhook_events, :source
      add_index :webhook_events, :created_at
    end

    add_column :webhook_events, :event_type, :string unless column_exists?(:webhook_events, :event_type)
    add_column :webhook_events, :payload_json, :jsonb unless column_exists?(:webhook_events, :payload_json)
    add_column :webhook_events, :processed_at, :datetime unless column_exists?(:webhook_events, :processed_at)
    add_column :webhook_events, :processing_error, :string unless column_exists?(:webhook_events, :processing_error)
  end
end
