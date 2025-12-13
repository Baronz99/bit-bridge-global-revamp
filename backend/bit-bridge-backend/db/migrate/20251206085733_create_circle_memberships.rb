class CreateCircleMemberships < ActiveRecord::Migration[7.1]
  def change
    create_table :circle_memberships, id: :uuid do |t|
      t.references :circle, null: false, type: :uuid, foreign_key: true
      t.references :user,   null: false, type: :uuid, foreign_key: true
      t.integer :role, null: false, default: 0   # 0 = member, 1 = admin

      t.timestamps
    end

    add_index :circle_memberships, [:circle_id, :user_id], unique: true
  end
end
