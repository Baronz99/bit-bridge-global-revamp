# frozen_string_literal: true

class AddAccountNameToAccount < ActiveRecord::Migration[7.1]
  def change
    add_column :accounts, :account_number, :string
    add_column :accounts, :bank_code, :string
    add_column :accounts, :bank_name, :string
    add_column :accounts, :account_name, :string
  end
end
