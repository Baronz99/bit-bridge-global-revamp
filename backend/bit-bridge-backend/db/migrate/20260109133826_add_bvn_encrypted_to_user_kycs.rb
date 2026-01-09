# frozen_string_literal: true

class AddBvnEncryptedToUserKycs < ActiveRecord::Migration[7.1]
  def change
    add_column :user_kycs, :bvn_encrypted, :string
    add_index  :user_kycs, :bvn_encrypted
  end
end
