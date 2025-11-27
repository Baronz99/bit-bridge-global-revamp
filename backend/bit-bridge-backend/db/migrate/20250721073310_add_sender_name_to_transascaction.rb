# frozen_string_literal: true

class AddSenderNameToTransascaction < ActiveRecord::Migration[7.1]
  def change
    add_column :transactions, :sender, :string
    add_column :transactions, :bank_code, :string
  end
end
