# frozen_string_literal: true

class RenameFundingAmountToAmount < ActiveRecord::Migration[7.1]
  def change
    rename_column :cards, :funding_amount, :amount
    # Ex:- rename_column("admin_users", "pasword","hashed_pasword")
  end
end
