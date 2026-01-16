# frozen_string_literal: true

class CreateKycBvnRetryEvents < ActiveRecord::Migration[7.1]
  def change
    create_table :kyc_bvn_retry_events, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid :user_id, null: false
      t.uuid :user_kyc_id, null: false
      t.integer :attempt_number, null: false
      t.string :status, null: false
      t.string :reason
      t.integer :next_wait_seconds
      t.string :provider_reference
      t.datetime :created_at, null: false
    end

    add_index :kyc_bvn_retry_events, :user_id
    add_index :kyc_bvn_retry_events, :user_kyc_id
  end
end
