# frozen_string_literal: true

class ChangeUserActiveStatusForUsers < ActiveRecord::Migration[7.1]
  def change
    change_column_default :users, :active, from: false, to: true
  end
end
