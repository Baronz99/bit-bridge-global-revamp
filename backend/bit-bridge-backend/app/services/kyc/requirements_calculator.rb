# frozen_string_literal: true

module Kyc
  class RequirementsCalculator
    def initialize(user)
      @user = user
    end

    def call
      profile = @user&.user_profile
      kyc = @user&.user_kyc

      bvn_verified = kyc&.bvn_status.to_s == "verified" || kyc&.bvn_verified_at.present?
      address_complete =
        profile.present? &&
        profile.address_line1.to_s.strip.present? &&
        profile.city.to_s.strip.present? &&
        profile.state.to_s.strip.present?
      docs_uploaded =
        profile.present? &&
        profile.id_document.attached? &&
        profile.proof_of_address.attached?

      tier2_ready = bvn_verified && address_complete && docs_uploaded

      tier3_status = kyc&.tier3_status.to_s
      tier3_started = %w[pending processing verified failed].include?(tier3_status)
      tier3_verified = kyc&.tier3_verified_at.present? || tier3_status == "verified"

      missing = []
      missing << "bvn" unless bvn_verified
      missing << "address" unless address_complete
      missing << "documents" unless docs_uploaded

      next_steps = next_steps_for(missing)

      {
        tier_current: @user&.kyc_level.presence || "tier_0",
        checks: {
          bvn_verified: bvn_verified,
          address_complete: address_complete,
          docs_uploaded: docs_uploaded,
          tier2_ready: tier2_ready,
          tier3_started: tier3_started,
          tier3_verified: tier3_verified
        },
        missing: missing,
        next_steps: next_steps
      }
    end

    private

    def next_steps_for(missing)
      steps = missing.map do |item|
        case item
        when "bvn"
          "Complete BVN verification."
        when "address"
          "Complete your address details."
        when "documents"
          "Upload your ID document and proof of address."
        end
      end.compact

      steps
    end
  end
end
