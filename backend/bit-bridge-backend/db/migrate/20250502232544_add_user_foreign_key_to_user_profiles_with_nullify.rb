# frozen_string_literal: true

class AddUserForeignKeyToUserProfilesWithNullify < ActiveRecord::Migration[7.1]
  def change
    add_foreign_key :user_profiles, :users, on_delete: :nullify
  end
end
