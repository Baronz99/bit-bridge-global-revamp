# frozen_string_literal: true

class AddDescriptionToTransactionRecord < ActiveRecord::Migration[7.1]
  def change
    add_column :transaction_records, :description, :string
    add_column :transaction_records, :phone_number, :string
  end
end
