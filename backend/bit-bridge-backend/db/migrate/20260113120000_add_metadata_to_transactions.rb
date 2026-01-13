# frozen_string_literal: true

class AddMetadataToTransactions < ActiveRecord::Migration[7.0]
  def change
    return if column_exists?(:transactions, :metadata)

    add_column :transactions, :metadata, :jsonb, default: {}, null: false
  end
end
