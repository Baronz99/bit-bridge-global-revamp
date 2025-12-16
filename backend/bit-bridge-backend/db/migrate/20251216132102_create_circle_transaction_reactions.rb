class CreateCircleTransactionReactions < ActiveRecord::Migration[7.0]
  def change
    create_table :circle_transaction_reactions, id: :uuid do |t|
      t.references :circle_transaction, null: false, foreign_key: true, type: :uuid
      t.references :user, null: false, foreign_key: true, type: :uuid
      t.string :emoji, null: false

      t.timestamps
    end

    add_index :circle_transaction_reactions,
              %i[circle_transaction_id user_id emoji],
              unique: true,
              name: "idx_circle_tx_reactions_unique"
  end
end
