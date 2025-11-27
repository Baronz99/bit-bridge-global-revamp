# frozen_string_literal: true

class CreateMonifyTokens < ActiveRecord::Migration[7.1]
  def change
    create_table :monify_tokens, id: :uuid do |t|
      t.string :token
      t.datetime :expires_in

      t.timestamps
    end
  end
end
