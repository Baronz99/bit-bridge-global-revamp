# frozen_string_literal: true

class UnmatchedCredit < ApplicationRecord
  STATUSES = %w[pending resolved ignored].freeze

  validates :provider, :provider_reference, :reason, :status, presence: true
  validates :status, inclusion: { in: STATUSES }
end

