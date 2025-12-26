# frozen_string_literal: true

class AddRefreshTokenDigestToUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :refresh_token_digest, :string
    add_index :users, :refresh_token_digest, unique: true
  end
end
