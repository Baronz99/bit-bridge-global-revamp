class AddTier3ToUserKycs < ActiveRecord::Migration[7.0]
  def change
    add_column :user_kycs, :tier3_status, :string, default: "not_started", null: false
    add_column :user_kycs, :tier3_reference, :string
    add_column :user_kycs, :tier3_verified_at, :datetime
    add_column :user_kycs, :tier3_error, :string
  end
end
