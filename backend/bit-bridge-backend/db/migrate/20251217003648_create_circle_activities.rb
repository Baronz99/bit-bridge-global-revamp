class CreateCircleActivities < ActiveRecord::Migration[7.1]
  def change
    create_table :circle_activities, id: :uuid do |t|
      t.references :circle, null: false, type: :uuid, foreign_key: true
      t.references :created_by, null: false, type: :uuid, foreign_key: { to_table: :users }

      t.string   :name, null: false
      t.integer  :target_amount_cents, null: false
      t.datetime :deadline_at, null: false

      t.integer :contribution_frequency, null: false, default: 0
      t.integer :status, null: false, default: 0

      t.timestamps
    end

    add_index :circle_activities, %i[circle_id status]
  end
end
