# frozen_string_literal: true

class AddCircleTypeToCircles < ActiveRecord::Migration[7.1]
  def change
    add_column :circles, :circle_type, :string, null: false, default: 'standard'
  end
end
