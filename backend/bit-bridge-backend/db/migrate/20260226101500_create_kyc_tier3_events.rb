# frozen_string_literal: true

class CreateKycTier3Events < ActiveRecord::Migration[7.1]
  def change
    create_table :kyc_tier3_events, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid :user_id
      t.uuid :user_kyc_id
      t.string :provider, null: false, default: "prembly"
      t.string :stage, null: false
      t.string :status, null: false
      t.string :provider_code
      t.string :provider_reference
      t.string :message
      t.jsonb :payload, null: false, default: {}

      t.timestamps
    end

    add_index :kyc_tier3_events, :created_at
    add_index :kyc_tier3_events, :provider
    add_index :kyc_tier3_events, :status
    add_index :kyc_tier3_events, :stage
    add_index :kyc_tier3_events, :user_id
    add_index :kyc_tier3_events, :user_kyc_id
    add_index :kyc_tier3_events, %i[status created_at]
    add_index :kyc_tier3_events, %i[user_kyc_id created_at]

    add_foreign_key :kyc_tier3_events, :users, column: :user_id
    add_foreign_key :kyc_tier3_events, :user_kycs, column: :user_kyc_id
  end
end
