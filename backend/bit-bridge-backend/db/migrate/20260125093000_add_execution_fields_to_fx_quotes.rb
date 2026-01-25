# frozen_string_literal: true

class AddExecutionFieldsToFxQuotes < ActiveRecord::Migration[7.0]
  def change
    add_column :fx_quotes, :executed_at, :datetime
    add_column :fx_quotes, :execution_reference, :string
  end
end
