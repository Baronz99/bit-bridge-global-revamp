# frozen_string_literal: true

class AddServiceTypeToProvision < ActiveRecord::Migration[7.1]
  def change
    add_column :provisions, :service_type, :string
  end
end
