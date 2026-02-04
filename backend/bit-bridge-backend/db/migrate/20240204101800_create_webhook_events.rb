class CreateWebhookEvents < ActiveRecord::Migration[7.1]
  def change
    create_table :webhook_events, id: :uuid do |t|
      t.string :source, null: false
      t.jsonb :headers
      t.jsonb :payload
      t.datetime :processed_at
      t.string :processing_error
      t.timestamps
    end

    add_index :webhook_events, :source
    add_index :webhook_events, :created_at
  end
end
