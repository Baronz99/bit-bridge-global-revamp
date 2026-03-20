# frozen_string_literal: true

class KycVerificationSnapshot < ApplicationRecord
  DOCUMENT_TYPES = %w[bvn nin].freeze

  encrypts :first_name, :last_name, :date_of_birth, :provider_reference

  validates :document_type, presence: true, inclusion: { in: DOCUMENT_TYPES }
  validates :fingerprint, presence: true
  validates :status, presence: true

  scope :for_document, ->(document_type) { where(document_type: document_type) }

  def reusable?
    expires_at.present? &&
      expires_at >= Time.current &&
      first_name.present? &&
      last_name.present? &&
      date_of_birth.present?
  end

  def to_result_hash
    {
      first_name: first_name,
      last_name: last_name,
      date_of_birth: date_of_birth,
      watchlisted: watchlisted,
      reference: provider_reference
    }
  end
end
