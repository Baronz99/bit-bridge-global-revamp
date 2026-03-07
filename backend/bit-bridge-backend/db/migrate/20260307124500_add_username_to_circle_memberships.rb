class AddUsernameToCircleMemberships < ActiveRecord::Migration[7.1]
  def change
    add_column :circle_memberships, :username, :string

    add_index :circle_memberships,
              'circle_id, LOWER(username)',
              unique: true,
              where: 'username IS NOT NULL',
              name: 'idx_circle_memberships_circle_username_unique'
  end
end
