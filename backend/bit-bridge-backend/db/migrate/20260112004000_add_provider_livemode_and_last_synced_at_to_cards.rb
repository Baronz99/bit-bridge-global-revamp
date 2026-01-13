# frozen_string_literal: true

class AddProviderLivemodeAndLastSyncedAtToCards < ActiveRecord::Migration[7.0]
  def change
    add_column :cards, :provider_livemode, :boolean
    add_column :cards, :last_synced_at, :datetime
  end
end
