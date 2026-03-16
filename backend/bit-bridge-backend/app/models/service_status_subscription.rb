# frozen_string_literal: true

class ServiceStatusSubscription < ApplicationRecord
  CHANNELS = %w[push].freeze

  belongs_to :user

  scope :active, -> {
    where(active: true).where('expires_at IS NULL OR expires_at > ?', Time.current)
  }

  validates :provider, :service_key, :channel, presence: true
  validates :channel, inclusion: { in: CHANNELS }
end
