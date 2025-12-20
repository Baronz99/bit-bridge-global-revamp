# frozen_string_literal: true

class CreatePhoneVerificationCodes < ActiveRecord::Migration[7.1]
  def change
    create_table :phone_verification_codes do |t|
      # ✅ Users table uses UUID, so reference must be UUID too
      t.references :user, null: false, foreign_key: true, type: :uuid

      t.string :phone_e164, null: false
      t.string :otp_digest, null: false

      t.datetime :expires_at, null: false
      t.datetime :last_sent_at

      t.integer :attempts, null: false, default: 0
      t.integer :send_count, null: false, default: 0

      # pending | verified | expired | failed | blocked
      t.string :status, null: false, default: "pending"

      t.timestamps
    end

    add_index :phone_verification_codes, [:user_id, :phone_e164]
    add_index :phone_verification_codes, :expires_at
    add_index :phone_verification_codes, :status
  end
end
