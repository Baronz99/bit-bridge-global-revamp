# frozen_string_literal: true

class AddRejectReasonToBillOrder < ActiveRecord::Migration[7.1]
  def change
    add_column :bill_orders, :reason, :text
  end
end
