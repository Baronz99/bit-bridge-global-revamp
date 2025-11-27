# frozen_string_literal: true

class CreateCurrencies < ActiveRecord::Migration[7.1]
  def change
    create_table :currencies, id: :uuid do |t|
      t.text :currency_rates
      t.string :rate_time_stamp
      # t.integer :pos_id

      t.timestamps
    end
  end
end
