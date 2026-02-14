class CreateProviderServiceStatuses < ActiveRecord::Migration[7.1]
  def change
    create_table :provider_service_statuses, id: :uuid do |t|
      t.string :provider, null: false
      t.string :service_key, null: false
      t.string :state, null: false
      t.integer :reliability_percent, null: false, default: 0
      t.integer :sample_size, null: false, default: 0
      t.datetime :window_started_at, null: false
      t.datetime :window_ended_at, null: false
      t.integer :avg_latency_ms
      t.text :last_error

      t.timestamps
    end

    add_index :provider_service_statuses,
              %i[provider service_key],
              unique: true,
              name: 'index_provider_service_statuses_on_provider_and_service_key'
  end
end