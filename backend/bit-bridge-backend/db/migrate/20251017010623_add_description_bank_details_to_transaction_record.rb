# frozen_string_literal: true

class AddDescriptionBankDetailsToTransactionRecord < ActiveRecord::Migration[7.1]
  def change
    add_column :transaction_records, :bank_code, :string
    add_column :transaction_records, :bank, :string
    add_column :transaction_records, :account_number, :string
    rename_column :transactions, :sender, :account_name
    # Ex:- change_column("admin_users", "email", :string, :limit =>25)
  end
end
