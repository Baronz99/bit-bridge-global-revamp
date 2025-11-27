# frozen_string_literal: true

class CreateProducts < ActiveRecord::Migration[7.1]
  def change
    create_table :products, id: :uuid do |t|
      t.boolean :featured, default: false
      t.string :extra_info
      t.string :provider
      t.string :image
      t.string :provision
      t.decimal :min_value
      t.decimal :max_value
      t.text :header_info
      t.text :description
      t.integer :rate, default: 5
      t.integer :category, default: 0
      t.integer :currency, default: 0
      t.text :info
      t.text :attention
      t.text :notice_info

      t.timestamps
    end
  end
end
