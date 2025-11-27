# frozen_string_literal: true

class AddUserReferenceToBillOrder < ActiveRecord::Migration[7.1]
  def change
    add_reference :bill_orders, :user, null: true, foreign_key: true, type: :uuid
  end
end
