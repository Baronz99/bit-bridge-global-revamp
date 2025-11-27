# frozen_string_literal: true

class AddAccountTypeToAccount < ActiveRecord::Migration[7.1]
  def change
    add_column :accounts, :account_type, :integer, default: 0
    add_column :accounts, :address, :string
    add_column :accounts, :city, :string
    add_column :accounts, :state, :string
    add_column :accounts, :postal_code, :string
    add_column :accounts, :country, :string, default: 'NG'
    add_column :accounts, :active, :boolean, default: false
    add_column :accounts, :status, :integer, default: 0
    # add_column :accounts, :dob, :timestamps
    add_column :accounts, :gender, :integer, default: 0
  end
end
