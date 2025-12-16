class CreateDisputes < ActiveRecord::Migration[7.0]
  def change
    create_table :disputes do |t|
      t.references :circle_transaction,
                   null: false,
                   foreign_key: true,
                   type: :uuid

      t.references :raised_by,
                   null: false,
                   foreign_key: { to_table: :users },
                   type: :uuid

      t.integer :status, default: 0, null: false
      t.string  :reason, null: false
      t.text    :note

      t.timestamps
    end
  end
end
