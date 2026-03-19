class AddMinContributionCentsToCircles < ActiveRecord::Migration[7.1]
  def change
    add_column :circles, :min_contribution_cents, :bigint
  end
end
