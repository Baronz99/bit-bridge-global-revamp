# frozen_string_literal: true

class AddUserForeignKeyToBillOrdersWithNullify < ActiveRecord::Migration[7.1]
  def change
    add_foreign_key :bill_orders, :users, on_delete: :nullify
  end
end
