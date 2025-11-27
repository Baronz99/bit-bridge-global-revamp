# frozen_string_literal: true

class AddInfoColumnToProvision < ActiveRecord::Migration[7.1]
  def change
    add_column :provisions, :info, :text
    add_column :provisions, :notice, :text
  end
end
