# frozen_string_literal: true

class CreateProvisions < ActiveRecord::Migration[7.1]
  def change
    create_table :provisions, id: :uuid do |t|
      t.string :name
      t.string :min_value
      t.string :max_value
      t.integer :provision_value_type
      t.references :product, null: false, foreign_key: true, type: :uuid

      t.timestamps
    end
  end
end
