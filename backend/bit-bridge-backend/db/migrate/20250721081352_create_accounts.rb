# frozen_string_literal: true

class CreateAccounts < ActiveRecord::Migration[7.1]
  def change
    create_table :accounts, id: :uuid do |t|
      t.string :vendor
      t.string :bvn
      t.references :user, null: false, foreign_key: true, type: :uuid

      t.timestamps
    end
  end
end
