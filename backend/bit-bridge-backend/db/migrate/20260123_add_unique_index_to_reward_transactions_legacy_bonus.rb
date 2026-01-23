class AddUniqueIndexToRewardTransactionsLegacyBonus < ActiveRecord::Migration[7.1]
  def change
    add_index :reward_transactions,
              [:user_id, :service_type, :source_label],
              unique: true,
              name: 'idx_reward_txn_user_service_source_label'
  end
end
