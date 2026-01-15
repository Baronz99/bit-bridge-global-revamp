# frozen_string_literal: true

class AddBvnSnapshotConstraintsToUserKycs < ActiveRecord::Migration[7.1]
  def change
    change_column_default :user_kycs, :bvn_snapshot_watchlisted, from: nil, to: false
    change_column_null :user_kycs, :bvn_snapshot_watchlisted, false, false
    add_index :user_kycs, :bvn_snapshot_expires_at
  end
end
