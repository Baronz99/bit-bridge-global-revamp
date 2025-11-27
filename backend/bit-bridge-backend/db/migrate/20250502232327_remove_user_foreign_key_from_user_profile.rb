# frozen_string_literal: true

class RemoveUserForeignKeyFromUserProfile < ActiveRecord::Migration[7.1]
  def change
    remove_foreign_key :user_profiles, :users
  end
end
