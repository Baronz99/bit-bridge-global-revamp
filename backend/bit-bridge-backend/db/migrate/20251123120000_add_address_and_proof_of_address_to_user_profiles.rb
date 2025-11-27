# db/migrate/20251123120000_add_address_and_proof_of_address_to_user_profiles.rb
class AddAddressAndProofOfAddressToUserProfiles < ActiveRecord::Migration[7.1]
  def change
    add_column :user_profiles, :address_line1, :string
    add_column :user_profiles, :address_line2, :string
    add_column :user_profiles, :city, :string
    add_column :user_profiles, :state, :string
    add_column :user_profiles, :country, :string
    add_column :user_profiles, :postal_code, :string
    add_column :user_profiles, :proof_of_address_type, :string
  end
end
