# frozen_string_literal: true

class CreateKycReviews < ActiveRecord::Migration[7.1]
  def change
    create_table :kyc_reviews, id: :uuid do |t|
      t.uuid :user_id, null: false
      t.string :kyc_type, null: false
      t.string :status, null: false, default: 'pending'
      t.string :reason
      t.text :notes
      t.uuid :assigned_to_admin_id
      t.uuid :decided_by_admin_id
      t.datetime :decided_at
      t.timestamps
    end

    add_index :kyc_reviews, :user_id
    add_index :kyc_reviews, :status
    add_index :kyc_reviews, :kyc_type
  end
end
