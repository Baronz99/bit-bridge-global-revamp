class AddUniqueIndexToRewardTransactionsLegacyBonus < ActiveRecord::Migration[7.1]
  def change
    add_index :reward_transactions,
              [:user_id, :service_type, :source_label],
              unique: true,
              where: "service_type = 'legacy_bonus'",
              name: "index_reward_txns_legacy_bonus_unique"
  end
end
