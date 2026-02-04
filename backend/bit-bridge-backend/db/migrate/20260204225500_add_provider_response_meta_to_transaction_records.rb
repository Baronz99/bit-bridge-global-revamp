# frozen_string_literal: true

class AddProviderResponseMetaToTransactionRecords < ActiveRecord::Migration[7.1]
  def change
    add_column :transaction_records, :response_code, :string
    add_column :transaction_records, :response_message, :string
    add_column :transaction_records, :provider_error_category, :string
  end
end
