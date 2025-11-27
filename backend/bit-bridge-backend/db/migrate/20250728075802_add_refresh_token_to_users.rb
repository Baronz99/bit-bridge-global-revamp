# frozen_string_literal: true

class AddRefreshTokenToUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :refresh_token, :string
    add_column :users, :refresh_token_expires_at, :datetime
  end
end
