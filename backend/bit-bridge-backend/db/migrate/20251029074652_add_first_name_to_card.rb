# frozen_string_literal: true

class AddFirstNameToCard < ActiveRecord::Migration[7.1]
  def change
    add_column :cards, :first_name, :string
    add_column :cards, :last_name, :string
    add_column :cards, :id_type, :string
  end
end
