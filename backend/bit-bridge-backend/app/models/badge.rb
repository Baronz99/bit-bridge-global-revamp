# frozen_string_literal: true

class Badge < ApplicationRecord
  has_many :user_badges, dependent: :destroy
  has_many :users, through: :user_badges

  validates :key, presence: true, uniqueness: true
  validates :name, presence: true
end
