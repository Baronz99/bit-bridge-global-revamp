# frozen_string_literal: true

class UserProfile < ApplicationRecord
  belongs_to :user
  validates :phone_number, uniqueness: true
end
