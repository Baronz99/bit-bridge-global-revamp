# frozen_string_literal: true

class AddUseableIdToAccount < ActiveRecord::Migration[7.1]
  def change
    add_column :accounts, :useable_id, :string
  end
end
