class AddAuditFieldsToUnmatchedCredits < ActiveRecord::Migration[7.1]
  def change
    add_column :unmatched_credits, :reviewed_at, :datetime
    add_column :unmatched_credits, :reviewed_by_user_id, :uuid
    add_column :unmatched_credits, :applied_at, :datetime
    add_column :unmatched_credits, :applied_by_user_id, :uuid
    add_column :unmatched_credits, :review_note, :text
    add_column :unmatched_credits, :apply_note, :text
    add_column :unmatched_credits, :last_request_id, :string

    add_index :unmatched_credits, :reviewed_by_user_id
    add_index :unmatched_credits, :applied_by_user_id
  end
end

