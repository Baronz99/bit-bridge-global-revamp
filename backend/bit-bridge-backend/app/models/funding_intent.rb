# frozen_string_literal: true

class FundingIntent < ApplicationRecord
  PROVIDERS = %w[anchor].freeze
  STATUSES = %w[pending detected credited expired cancelled].freeze

  belongs_to :user
  belongs_to :credited_transaction, class_name: 'Transaction', optional: true

  validates :provider, inclusion: { in: PROVIDERS }
  validates :reference, presence: true, uniqueness: true
  validates :status, inclusion: { in: STATUSES }
  validates :expires_at, presence: true
end
