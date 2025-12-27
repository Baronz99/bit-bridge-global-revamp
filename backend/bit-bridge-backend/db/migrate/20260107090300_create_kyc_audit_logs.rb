# frozen_string_literal: true

class CreateKycAuditLogs < ActiveRecord::Migration[7.1]
  def change
    create_table :kyc_audit_logs, id: :uuid do |t|
      t.uuid :user_id
      t.uuid :admin_id
      t.string :action, null: false
      t.string :status
      t.string :ip_address
      t.jsonb :metadata, default: {}
      t.timestamps
    end

    add_index :kyc_audit_logs, :user_id
    add_index :kyc_audit_logs, :admin_id
    add_index :kyc_audit_logs, :action
  end
end
