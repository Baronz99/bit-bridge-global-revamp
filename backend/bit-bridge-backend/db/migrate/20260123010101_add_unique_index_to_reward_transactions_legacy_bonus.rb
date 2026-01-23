class AddUniqueIndexToRewardTransactionsLegacyBonus < ActiveRecord::Migration[7.1]
  def change
    add_index :reward_transactions,
              [:user_id, :service_type, :source_label],
              unique: true,
              name: "index_reward_txns_on_user_service_source_label"
  end
end
