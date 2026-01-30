# frozen_string_literal: true

class AddGenderToUserProfiles < ActiveRecord::Migration[7.1]
  def change
    add_column :user_profiles, :gender, :string, null: true
  end
end
