# frozen_string_literal: true

class AddBvnStatusToUserProfiles < ActiveRecord::Migration[7.1]
  def change
    add_column :user_profiles, :bvn, :string
    add_column :user_profiles, :bvn_status, :string
    add_column :user_profiles, :bvn_verified_at, :datetime
    add_column :user_profiles, :bvn_rejection_reason, :string
  end
end
