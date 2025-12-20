# frozen_string_literal: true

class AddDeliveryFieldsToPhoneVerificationCodes < ActiveRecord::Migration[7.1]
  def change
    change_table :phone_verification_codes, bulk: true do |t|
      # Provider tracking
      t.string   :provider
      t.string   :provider_message_id
      t.string   :provider_status
      t.datetime :last_status_at

      # Abuse + debugging metadata
      t.string :ip_address
      t.string :user_agent
    end

    add_index :phone_verification_codes, :provider_message_id
    add_index :phone_verification_codes, [:user_id, :created_at]
    add_index :phone_verification_codes, [:phone_e164, :created_at]
  end
end
