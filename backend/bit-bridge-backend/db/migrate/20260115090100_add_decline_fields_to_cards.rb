# frozen_string_literal: true

class AddDeclineFieldsToCards < ActiveRecord::Migration[7.1]
  def change
    change_table :cards, bulk: true do |t|
      t.integer :decline_count, default: 0, null: false
      t.datetime :last_declined_at
      t.string :frozen_by
      t.string :frozen_reason
    end
  end
end
