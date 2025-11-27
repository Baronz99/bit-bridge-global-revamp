# frozen_string_literal: true

class AddProvisionRefToOderItem < ActiveRecord::Migration[7.1]
  def change
    add_reference :order_items, :provision, null: true, foreign_key: true, type: :uuid
  end
end
