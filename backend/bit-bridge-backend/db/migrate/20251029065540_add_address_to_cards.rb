# frozen_string_literal: true

class AddAddressToCards < ActiveRecord::Migration[7.1]
  def change
    add_column :cards, :address, :string
    add_column :cards, :city, :string
    add_column :cards, :state, :string
    add_column :cards, :postal, :string
    add_column :cards, :house_no, :string
    add_column :cards, :bvn, :string
    add_column :cards, :account_source, :string
  end
end
