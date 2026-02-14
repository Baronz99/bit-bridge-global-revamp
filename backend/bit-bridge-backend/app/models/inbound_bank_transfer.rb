# frozen_string_literal: true

class InboundBankTransfer < ApplicationRecord
  PROVIDERS = %w[anchor].freeze
  STATUSES = %w[unmatched matched credited review].freeze

  belongs_to :matched_user, class_name: 'User', optional: true
  belongs_to :funding_intent, optional: true
  belongs_to :credited_transaction, class_name: 'Transaction', optional: true

  validates :provider, inclusion: { in: PROVIDERS }
  validates :provider_reference, presence: true, uniqueness: { scope: :provider }
  validates :amount_cents, numericality: { greater_than_or_equal_to: 0 }
  validates :currency, presence: true
  validates :status, inclusion: { in: STATUSES }
end
