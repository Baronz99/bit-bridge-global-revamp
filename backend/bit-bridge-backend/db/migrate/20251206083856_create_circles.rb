class CreateCircles < ActiveRecord::Migration[7.1]
  def change
    create_table :circles, id: :uuid do |t|
      t.string :name, null: false
      t.string :purpose
      t.text :description

      # 👇 IMPORTANT: this says "owner_id is a UUID that points to the users table"
      t.references :owner,
                   null: false,
                   type: :uuid,
                   foreign_key: { to_table: :users }

      t.timestamps
    end
  end
end
