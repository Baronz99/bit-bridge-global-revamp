# frozen_string_literal: true

class EnforceMoneyPrecision < ActiveRecord::Migration[7.1]
  def change
    change_column :bill_orders, :amount, :decimal, precision: 18, scale: 2
    change_column :bill_orders, :total_amount, :decimal, precision: 18, scale: 2
    change_column :bill_orders, :service_charge, :decimal, precision: 18, scale: 2, default: "0.0"

    change_column :transactions, :amount, :decimal, precision: 18, scale: 2
    change_column :transactions, :bonus, :decimal, precision: 18, scale: 2, default: "0.0"

    change_column :wallet_ledger_entries, :amount, :decimal, precision: 18, scale: 2, null: false

    change_column :wallets, :commission, :decimal, precision: 18, scale: 2
  end
end
