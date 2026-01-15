# frozen_string_literal: true

class AddBvnSnapshotToUserKycs < ActiveRecord::Migration[7.1]
  def change
    add_column :user_kycs, :bvn_snapshot_first_name, :string
    add_column :user_kycs, :bvn_snapshot_last_name, :string
    add_column :user_kycs, :bvn_snapshot_dob, :string
    add_column :user_kycs, :bvn_snapshot_watchlisted, :boolean
    add_column :user_kycs, :bvn_snapshot_reference, :string
    add_column :user_kycs, :bvn_snapshot_captured_at, :datetime
    add_column :user_kycs, :bvn_snapshot_expires_at, :datetime
  end
end
