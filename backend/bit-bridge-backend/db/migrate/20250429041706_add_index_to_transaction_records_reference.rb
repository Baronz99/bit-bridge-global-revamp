# frozen_string_literal: true

class AddIndexToTransactionRecordsReference < ActiveRecord::Migration[7.1]
  def change
    add_index :transaction_records, :reference, unique: true
  end
end
