# frozen_string_literal: true

class AddCouponBonusToTransaction < ActiveRecord::Migration[7.1]
  def change
    add_column :transactions, :bonus, :decimal, default: 0
  end
end
