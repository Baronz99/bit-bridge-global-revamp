# frozen_string_literal: true

class AddProviderStatusToCards < ActiveRecord::Migration[7.0]
  def change
    add_column :cards, :provider_status, :string
    add_column :cards, :provider_updated_at, :datetime
    add_column :cards, :last_provider_sync_error, :string
  end
end
