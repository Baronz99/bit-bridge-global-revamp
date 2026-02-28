# frozen_string_literal: true

module Kyc
  class LevelCalculator
    def self.resolve_level(user)
      profile = user.user_profile
      kyc = user.user_kyc

      # Preserve Tier 3 once liveness has been verified.
      return 'tier_3' if tier3_verified?(kyc)

      tier1 = tier1_complete?(profile)
      tier2 = tier1 && tier2_complete?(user, profile, kyc)

      return 'tier_2' if tier2
      return 'tier_1' if tier1

      'tier_0'
    end

    def self.tier3_verified?(kyc)
      return false unless kyc

      kyc.tier3_status.to_s == 'verified' || kyc.tier3_verified_at.present?
    end

    def self.nin_verified?(kyc)
      return false unless kyc

      kyc.nin_status.to_s == 'verified' || kyc.nin_verified_at.present?
    end

    def self.tier1_complete?(profile)
      return false unless profile

      has_names = profile.first_name.present? && profile.last_name.present?
      has_phone = profile.phone_number.present?
      phone_verified = profile.phone_verified_at.present?
      has_dob = profile.date_of_birth.present?

      has_names && has_phone && phone_verified && has_dob
    end

    def self.tier2_complete?(user, profile, kyc)
      return false unless profile && kyc

      has_bvn_verified = kyc.bvn_status == 'verified'
      has_nin_verified = nin_verified?(kyc)
      has_id_type = user.id_type.present?
      has_address =
        profile.address_line1.present? &&
        profile.city.present? &&
        profile.state.present? &&
        profile.country.present?
      has_proof = profile.proof_of_address_type.present?
      has_id_document = profile.respond_to?(:id_document) && profile.id_document.attached?
      has_proof_doc = profile.respond_to?(:proof_of_address) && profile.proof_of_address.attached?
      has_identity_evidence = has_id_document || has_nin_verified

      has_bvn_verified && has_id_type && has_address && has_proof && has_identity_evidence && has_proof_doc
    end
  end
end
