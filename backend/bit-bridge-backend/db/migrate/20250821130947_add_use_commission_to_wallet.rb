# frozen_string_literal: true

class AddUseCommissionToWallet < ActiveRecord::Migration[7.1]
  def change
    add_column :bill_orders, :use_commission, :boolean
  end
end
