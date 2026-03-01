# frozen_string_literal: true

class AddUniqueActiveAnchorAccountPerUser < ActiveRecord::Migration[7.1]
  INDEX_NAME = 'idx_unique_active_anchor_account_per_user'.freeze

  def up
    dedupe_active_anchor_accounts!

    return if index_exists?(:accounts, :user_id, name: INDEX_NAME)

    add_index :accounts, :user_id,
              unique: true,
              where: "vendor = 'anchor' AND active = TRUE",
              name: INDEX_NAME
  end

  def down
    remove_index :accounts, name: INDEX_NAME if index_exists?(:accounts, :user_id, name: INDEX_NAME)
  end

  private

  def dedupe_active_anchor_accounts!
    execute <<~SQL.squish
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY user_id
                 ORDER BY
                   CASE
                     WHEN account_number IS NOT NULL AND account_number <> '' THEN 0
                     WHEN useable_id IS NOT NULL AND useable_id <> '' THEN 1
                     ELSE 2
                   END ASC,
                   status DESC,
                   updated_at DESC,
                   created_at DESC
               ) AS rank_position
        FROM accounts
        WHERE vendor = 'anchor' AND active = TRUE
      )
      UPDATE accounts
      SET active = FALSE, updated_at = NOW()
      WHERE id IN (
        SELECT id
        FROM ranked
        WHERE rank_position > 1
      )
    SQL
  end
end
