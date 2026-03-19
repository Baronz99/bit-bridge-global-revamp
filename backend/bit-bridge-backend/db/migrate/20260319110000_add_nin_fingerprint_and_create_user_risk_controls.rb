class AddNinFingerprintAndCreateUserRiskControls < ActiveRecord::Migration[7.1]
  def change
    add_column :user_kycs, :nin_fingerprint, :string
    add_index :user_kycs, :nin_fingerprint

    create_table :user_risk_controls, id: :uuid do |t|
      t.references :user, null: false, type: :uuid, foreign_key: true, index: { unique: true }
      t.boolean :monitoring_enabled, null: false, default: false
      t.boolean :auto_lock_enabled, null: false, default: false
      t.bigint :single_txn_limit_cents
      t.bigint :daily_limit_cents
      t.bigint :weekly_limit_cents
      t.boolean :restricted, null: false, default: false
      t.string :restriction_reason
      t.datetime :provider_freeze_requested_at
      t.string :provider_freeze_status
      t.text :provider_freeze_error
      t.uuid :set_by_admin_id
      t.uuid :released_by_admin_id
      t.datetime :released_at
      t.timestamps
    end

    add_foreign_key :user_risk_controls, :users, column: :set_by_admin_id
    add_foreign_key :user_risk_controls, :users, column: :released_by_admin_id

    create_table :risk_events, id: :uuid do |t|
      t.references :user, null: false, type: :uuid, foreign_key: true
      t.string :trigger_type, null: false
      t.bigint :amount_cents
      t.bigint :threshold_cents
      t.string :action_taken, null: false
      t.string :source_type
      t.uuid :source_id
      t.jsonb :metadata, null: false, default: {}
      t.timestamps
    end

    add_index :risk_events, [:user_id, :created_at]
    add_index :risk_events, :trigger_type
  end
end
