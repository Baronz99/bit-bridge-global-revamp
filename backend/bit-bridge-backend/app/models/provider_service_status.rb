# frozen_string_literal: true

class ProviderServiceStatus < ApplicationRecord
  STATES = %w[available unstable down unknown].freeze

  validates :provider, presence: true
  validates :service_key, presence: true
  validates :state, inclusion: { in: STATES }
  validates :reliability_percent, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }
  validates :sample_size, numericality: { greater_than_or_equal_to: 0 }
  validates :window_started_at, :window_ended_at, presence: true
end