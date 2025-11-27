# frozen_string_literal: true

class CreateGiftCards < ActiveRecord::Migration[7.1]
  def change
    create_table :gift_cards, id: :uuid do |t|
      t.string :provider
      t.string :provision
      t.decimal :value
      t.text :header_info
      t.text :description
      t.integer :rating
      t.text :notice_info
      t.text :alert_info
      t.decimal :value_max
      t.decimal :value_min

      t.timestamps
    end
  end
end
