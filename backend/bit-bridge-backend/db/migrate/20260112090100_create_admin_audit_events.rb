# frozen_string_literal: true

class CreateAdminAuditEvents < ActiveRecord::Migration[7.1]
  def change
    create_table :admin_audit_events, id: :uuid do |t|
      t.uuid :admin_user_id, null: false
      t.uuid :target_user_id
      t.string :action, null: false
      t.string :ip
      t.string :user_agent
      t.jsonb :metadata, null: false, default: {}

      t.timestamps
    end

    add_index :admin_audit_events, :admin_user_id
    add_index :admin_audit_events, :target_user_id
    add_index :admin_audit_events, :action
    add_foreign_key :admin_audit_events, :users, column: :admin_user_id
    add_foreign_key :admin_audit_events, :users, column: :target_user_id
  end
end
