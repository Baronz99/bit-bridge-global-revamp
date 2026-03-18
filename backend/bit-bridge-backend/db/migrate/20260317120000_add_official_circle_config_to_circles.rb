# frozen_string_literal: true

class AddOfficialCircleConfigToCircles < ActiveRecord::Migration[7.1]
  def change
    add_column :circles, :kyc_mode, :string, null: false, default: 'strict'
    add_column :circles, :max_contribution_cents, :bigint
    add_column :circles, :badge_label, :string
    add_column :circles, :visibility, :string, null: false, default: 'private'
  end
end
