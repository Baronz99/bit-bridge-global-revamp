# frozen_string_literal: true

class CreateRefundRequests < ActiveRecord::Migration[7.1]
  def change
    create_table :refund_requests, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid :user_id
      t.string :transaction_reference, null: false
      t.string :provider
      t.string :reason, null: false
      t.integer :status, default: 0, null: false

      t.datetime :requested_at, null: false
      t.datetime :acknowledged_at
      t.datetime :approved_at
      t.datetime :rejected_at
      t.datetime :refunded_at

      t.uuid :handled_by_admin_id
      t.text :notes

      t.timestamps
    end

    add_index :refund_requests, :status
    add_index :refund_requests, :transaction_reference
    add_index :refund_requests, :requested_at
    add_index :refund_requests, :provider
    add_foreign_key :refund_requests, :users, column: :user_id
    add_foreign_key :refund_requests, :users, column: :handled_by_admin_id
  end
end
