# frozen_string_literal: true

class AddDobToAccount < ActiveRecord::Migration[7.1]
  def change
    add_column :accounts, :dob, :date
  end
end
