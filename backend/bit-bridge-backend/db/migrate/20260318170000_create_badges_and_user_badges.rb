class CreateBadgesAndUserBadges < ActiveRecord::Migration[7.1]
  def change
    create_table :badges, id: :uuid do |t|
      t.string :key, null: false
      t.string :name, null: false
      t.text :description
      t.boolean :active, null: false, default: true

      t.timestamps
    end

    add_index :badges, :key, unique: true

    create_table :user_badges, id: :uuid do |t|
      t.references :user, null: false, foreign_key: true, type: :uuid
      t.references :badge, null: false, foreign_key: true, type: :uuid
      t.uuid :granted_by_user_id
      t.uuid :source_circle_id
      t.string :source_rule
      t.datetime :granted_at, null: false
      t.jsonb :metadata, null: false, default: {}

      t.timestamps
    end

    add_foreign_key :user_badges, :users, column: :granted_by_user_id
    add_foreign_key :user_badges, :circles, column: :source_circle_id
    add_index :user_badges, %i[user_id badge_id source_circle_id], unique: true, name: 'index_user_badges_unique_source'
    add_index :user_badges, :granted_at
  end
end
