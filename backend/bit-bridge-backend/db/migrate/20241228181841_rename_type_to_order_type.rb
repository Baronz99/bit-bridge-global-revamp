# frozen_string_literal: true

class RenameTypeToOrderType < ActiveRecord::Migration[7.1]
  def change
    rename_column :order_details, :type, :order_type
    # Ex:- rename_column("admin_users", "pasword","hashed_pasword")
  end
end
