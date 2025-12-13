# db/migrate/XXXXXXXXXXXXXX_create_circle_transactions.rb
class CreateCircleTransactions < ActiveRecord::Migration[7.1]
  def change
    create_table :circle_transactions, id: :uuid do |t|
      t.references :circle, null: false, foreign_key: true, type: :uuid
      t.references :user,   null: false, foreign_key: true, type: :uuid

      t.integer  :amount_cents, null: false, default: 0
      t.integer  :direction,    null: false, default: 0  # 0=credit, 1=debit
      t.string   :kind,         null: false, default: 'manual'
      t.string   :description
      t.string   :reference
      t.datetime :occurred_at,  null: false
      t.jsonb    :metadata,     null: false, default: {}

      t.timestamps
    end

    add_index :circle_transactions, [:circle_id, :occurred_at]
  end
end
