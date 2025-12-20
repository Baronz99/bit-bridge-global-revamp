class AddCircleActivityToCircleTransactions < ActiveRecord::Migration[7.1]
  def change
    add_reference :circle_transactions, :circle_activity, type: :uuid, foreign_key: true, null: true
    add_index :circle_transactions, %i[circle_id circle_activity_id]
  end
end
