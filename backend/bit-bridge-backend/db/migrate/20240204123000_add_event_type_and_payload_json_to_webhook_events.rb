class AddEventTypeAndPayloadJsonToWebhookEvents < ActiveRecord::Migration[7.1]
  def change
    add_column :webhook_events, :event_type, :string unless column_exists?(:webhook_events, :event_type)
    add_column :webhook_events, :payload_json, :jsonb unless column_exists?(:webhook_events, :payload_json)
  end
end
