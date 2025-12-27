# frozen_string_literal: true

class CreateKycAttempts < ActiveRecord::Migration[7.1]
  def change
    create_table :kyc_attempts, id: :uuid do |t|
      t.uuid :user_id
      t.string :kyc_type, null: false
      t.string :ip_address, null: false
      t.boolean :success, null: false, default: false
      t.string :result_status
      t.timestamps
    end

    add_index :kyc_attempts, :user_id
    add_index :kyc_attempts, :ip_address
    add_index :kyc_attempts, :created_at
  end
end
