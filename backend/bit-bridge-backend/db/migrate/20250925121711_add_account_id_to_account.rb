# frozen_string_literal: true

class AddAccountIdToAccount < ActiveRecord::Migration[7.1]
  def change
    add_column :accounts, :account_id, :string
    add_index :accounts, :account_id, unique: true
  end
end
