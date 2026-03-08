class CleanupAnchorCustomerIdsInUseableId < ActiveRecord::Migration[7.1]
  def up
    execute <<~SQL.squish
      UPDATE accounts
      SET useable_id = NULL, updated_at = NOW()
      WHERE vendor = 'anchor'
        AND account_number IS NULL
        AND useable_id IS NOT NULL
        AND useable_id <> ''
        AND useable_id NOT LIKE '%-anc_acc'
    SQL
  end

  def down
    # irreversible: cleared values represented invalid semantics for useable_id
  end
end
