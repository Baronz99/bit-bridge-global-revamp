# frozen_string_literal: true

class AddTransferIdToTransaction < ActiveRecord::Migration[7.1]
  def change
    add_index :transactions, :transfer_id, unique: true
  end
end
