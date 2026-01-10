# frozen_string_literal: true

class AddAdminFieldsToUsers < ActiveRecord::Migration[7.1]
  def up
    add_column :users, :admin_role, :string
    add_column :users, :admin_auth_time, :datetime

    execute <<~SQL.squish
      UPDATE users
      SET admin_role = 'super_admin'
      WHERE role = 'super_admin'
    SQL

    execute <<~SQL.squish
      UPDATE users
      SET admin_role = 'support'
      WHERE role = 'admin' AND (admin_role IS NULL OR admin_role = '')
    SQL
  end

  def down
    remove_column :users, :admin_role
    remove_column :users, :admin_auth_time
  end
end
