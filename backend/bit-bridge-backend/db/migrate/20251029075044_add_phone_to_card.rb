# frozen_string_literal: true

class AddPhoneToCard < ActiveRecord::Migration[7.1]
  def change
    add_column :cards, :phone, :string
  end
end
