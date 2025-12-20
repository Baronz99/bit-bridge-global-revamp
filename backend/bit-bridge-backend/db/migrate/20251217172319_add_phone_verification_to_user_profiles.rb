class AddPhoneVerificationToUserProfiles < ActiveRecord::Migration[7.1]
  def change
    add_column :user_profiles, :phone_e164, :string
    add_column :user_profiles, :phone_verified_at, :datetime
    add_index  :user_profiles, :phone_e164
  end
end
