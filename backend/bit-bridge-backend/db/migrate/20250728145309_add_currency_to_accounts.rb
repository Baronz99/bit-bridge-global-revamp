# frozen_string_literal: true

class AddCurrencyToAccounts < ActiveRecord::Migration[7.1]
  def change
    add_column :accounts, :currency, :string
  end
end
