# frozen_string_literal: true

class CreateRefreshSessions < ActiveRecord::Migration[7.1]
  def change
    create_table :refresh_sessions, id: :uuid do |t|
      t.references :user, null: false, foreign_key: true, type: :uuid
      t.string :token_digest, null: false
      t.datetime :expires_at, null: false
      t.datetime :revoked_at
      t.datetime :last_used_at
      t.datetime :last_rotated_at
      t.string :ip_address
      t.string :user_agent

      t.timestamps
    end

    add_index :refresh_sessions, :token_digest, unique: true
    add_index :refresh_sessions, [:user_id, :revoked_at]
    add_index :refresh_sessions, [:user_id, :expires_at]
  end
end
