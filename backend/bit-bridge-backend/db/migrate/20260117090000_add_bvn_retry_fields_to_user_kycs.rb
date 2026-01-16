# frozen_string_literal: true

class AddBvnRetryFieldsToUserKycs < ActiveRecord::Migration[7.1]
  def change
    add_column :user_kycs, :bvn_retry_attempt, :integer, default: 0, null: false
    add_column :user_kycs, :bvn_retry_next_at, :datetime
    add_column :user_kycs, :bvn_retry_locked_at, :datetime
    add_index :user_kycs, :bvn_retry_locked_at
  end
end
