# frozen_string_literal: true

class CreateTransactionPinResetCodes < ActiveRecord::Migration[7.1]
  def change
    create_table :transaction_pin_reset_codes do |t|
      # IMPORTANT: users.id is UUID in this app, so reference must be UUID
      t.references :user, null: false, foreign_key: true, type: :uuid

      t.string :phone_e164, null: false

      t.string :otp_digest, null: false
      t.datetime :expires_at, null: false
      t.string :status, null: false, default: "pending" # pending|verified|expired|blocked|failed

      t.integer :attempts, null: false, default: 0
      t.integer :send_count, null: false, default: 0
      t.datetime :last_sent_at

      t.string :ip_address
      t.string :user_agent
      t.string :provider, default: "termii"
      t.string :provider_message_id
      t.string :provider_status
      t.datetime :last_status_at

      t.timestamps
    end

    add_index :transaction_pin_reset_codes, [:user_id, :phone_e164]
    add_index :transaction_pin_reset_codes, :expires_at
    add_index :transaction_pin_reset_codes, :status
  end
end
