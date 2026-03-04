# frozen_string_literal: true

class NotificationDevice < ApplicationRecord
  belongs_to :user
  has_many :notification_deliveries, dependent: :destroy

  enum :provider, { expo: 'expo' }, validate: true

  scope :active, -> { where(active: true) }

  validates :token, presence: true
  validates :provider, presence: true
  validates :token, uniqueness: { scope: :provider }
end
