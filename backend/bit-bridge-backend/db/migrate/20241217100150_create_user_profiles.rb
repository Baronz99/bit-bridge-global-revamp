# frozen_string_literal: true

class CreateUserProfiles < ActiveRecord::Migration[7.1]
  def change
    create_table :user_profiles, id: :uuid do |t|
      t.string :first_name
      t.string :last_name
      t.string :phone_number
      t.references :user, null: false, foreign_key: true, type: :uuid

      t.timestamps
    end
  end
end
