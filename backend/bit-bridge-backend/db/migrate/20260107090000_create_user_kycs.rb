# frozen_string_literal: true

class CreateUserKycs < ActiveRecord::Migration[7.1]
  def change
    create_table :user_kycs, id: :uuid do |t|
      t.uuid :user_id, null: false
      t.string :bvn_status, null: false, default: 'unverified'
      t.string :bvn_last4
      t.string :bvn_provider, null: false, default: 'prembly'
      t.string :bvn_provider_reference
      t.datetime :bvn_verified_at
      t.boolean :bvn_name_match
      t.boolean :bvn_dob_match
      t.boolean :bvn_first_name_match
      t.boolean :bvn_last_name_match
      t.decimal :bvn_match_score, precision: 4, scale: 3
      t.boolean :watchlisted
      t.integer :bvn_attempts_count, null: false, default: 0
      t.integer :bvn_failed_attempts_count, null: false, default: 0
      t.datetime :bvn_locked_until
      t.datetime :bvn_last_attempt_at
      t.string :bvn_fingerprint
      t.timestamps
    end

    add_index :user_kycs, :user_id, unique: true
    add_index :user_kycs, :bvn_status
    add_index :user_kycs, :bvn_fingerprint
  end
end
