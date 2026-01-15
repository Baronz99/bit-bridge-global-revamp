# frozen_string_literal: true

class AddBvnCacheFieldsToUserKycs < ActiveRecord::Migration[7.1]
  def change
    add_column :user_kycs, :bvn_last_result_status, :string
    add_column :user_kycs, :bvn_last_result_reason, :string
    add_column :user_kycs, :bvn_last_checked_at, :datetime
    add_column :user_kycs, :bvn_last_profile_fingerprint, :string
  end
end
