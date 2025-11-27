# frozen_string_literal: true

class AddDateOfBirthToUserProfiles < ActiveRecord::Migration[7.0]
  def change
    add_column :user_profiles, :date_of_birth, :date
  end
end
