class AddMoreOnboardingFieldsToUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :onboarding_stage, :string
    add_column :users, :primary_use_case, :string
    add_column :users, :kyc_level, :string
    add_column :users, :id_type, :string
    add_column :users, :id_number, :string
  end
end
