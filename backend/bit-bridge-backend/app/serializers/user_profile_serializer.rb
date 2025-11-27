# frozen_string_literal: true

class UserProfileSerializer < ActiveModel::Serializer
  attributes :id,
             :first_name,
             :last_name,
             :phone_number,
             :date_of_birth,          # 👈 NEW
             :address_line1,
             :address_line2,
             :city,
             :state,
             :country,
             :postal_code,
             :proof_of_address_type

  # If you don't want to expose the full user object, remove this
  # has_one :user
end
