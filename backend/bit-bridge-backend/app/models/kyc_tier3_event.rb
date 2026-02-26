# frozen_string_literal: true

class KycTier3Event < ApplicationRecord
  STATUSES = %w[
    queued
    success
    rejected
    failed
    retryable_failed
    timed_out
  ].freeze

  belongs_to :user, optional: true
  belongs_to :user_kyc, optional: true

  validates :provider, :stage, :status, presence: true

  def self.record!(
    user: nil,
    user_kyc: nil,
    provider: "prembly",
    stage:,
    status:,
    provider_code: nil,
    provider_reference: nil,
    message: nil,
    payload: {}
  )
    create!(
      user_id: user&.id,
      user_kyc_id: user_kyc&.id,
      provider: provider.to_s.presence || "prembly",
      stage: stage.to_s,
      status: status.to_s,
      provider_code: provider_code.to_s.presence,
      provider_reference: provider_reference.to_s.presence,
      message: message.to_s.presence,
      payload: payload.is_a?(Hash) ? payload : {}
    )
  rescue StandardError => e
    Rails.logger.warn("[Tier3Event] persist_failed #{e.class}: #{e.message}")
    nil
  end
end
