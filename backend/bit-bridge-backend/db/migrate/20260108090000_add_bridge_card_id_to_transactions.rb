# frozen_string_literal: true

class AddBridgeCardIdToTransactions < ActiveRecord::Migration[7.1]
  def change
    add_column :transactions, :bridge_card_id, :string
    add_index :transactions, :bridge_card_id
  end
end
