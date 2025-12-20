class AddTreasurerRoleToCircleMemberships < ActiveRecord::Migration[7.1]
  def up
    # Previously: member:0, admin:1
    # New:        member:0, treasurer:1, admin:2
    # So bump existing admin=1 -> 2
    execute "UPDATE circle_memberships SET role = 2 WHERE role = 1"
  end

  def down
    # revert admin=2 -> 1, treasurer=1 -> 0 (or you can block downgrade)
    execute "UPDATE circle_memberships SET role = 1 WHERE role = 2"
    execute "UPDATE circle_memberships SET role = 0 WHERE role = 1"
  end
end
