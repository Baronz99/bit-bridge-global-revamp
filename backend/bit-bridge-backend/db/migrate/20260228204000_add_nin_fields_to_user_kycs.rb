class AddNinFieldsToUserKycs < ActiveRecord::Migration[7.1]
  def change
    change_table :user_kycs, bulk: true do |t|
      t.string :nin_status, null: false, default: "unverified"
      t.string :nin_last4
      t.string :nin_provider, null: false, default: "prembly"
      t.string :nin_provider_reference
      t.datetime :nin_verified_at
      t.string :nin_last_result_status
      t.string :nin_last_result_reason
      t.datetime :nin_last_checked_at
      t.string :nin_encrypted
      t.boolean :nin_name_match
      t.boolean :nin_dob_match
      t.boolean :nin_first_name_match
      t.boolean :nin_last_name_match
      t.decimal :nin_match_score, precision: 4, scale: 3
    end

    add_index :user_kycs, :nin_status
    add_index :user_kycs, :nin_encrypted
  end
end

