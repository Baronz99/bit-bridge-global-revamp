# frozen_string_literal: true

class MigrateUsdtWalletsToUsd < ActiveRecord::Migration[7.1]
  def up
    # usdt was used as "tunnel" previously. We are now standardizing to USD for production.
    # wallet_type is an integer enum.
    # Old mapping assumed: ngn: 0, usdt: 1
    # New mapping:          ngn: 0, usdt: 1 (legacy), usd: 2

    # Convert any existing usdt wallets to usd and normalize currency to USD.
    execute <<~SQL
      UPDATE wallets
      SET wallet_type = 2,
          currency = 'USD'
      WHERE wallet_type = 1;
    SQL
  end

  def down
    # Revert back to legacy usdt mapping if needed (not recommended).
    execute <<~SQL
      UPDATE wallets
      SET wallet_type = 1,
          currency = 'USDT'
      WHERE wallet_type = 2 AND currency = 'USD';
    SQL
  end
end
