# frozen_string_literal: true

module Core
  module Kyc
    class LevelCalculator
      def self.resolve_level(user)
        profile = user.user_profile
        kyc = user.user_kyc

        return 'tier_0' unless tier1_complete?(profile)
        return 'tier_1' unless tier2_complete?(user, profile, kyc)
        return 'tier_2' unless tier3_complete?(user, profile, kyc)
        return 'tier_3' unless tier4_complete?(user, profile, kyc)

        'tier_4'
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
        has_id_document = profile.respond_to?(:id_document) && profile.id_document.attached?
        has_identity_evidence = has_id_document || has_nin_verified

        has_bvn_verified && has_id_type && has_identity_evidence
      end

      def self.tier3_complete?(user, profile, kyc)
        return false unless tier2_complete?(user, profile, kyc)

        tier3_verified?(kyc)
      end

      def self.tier4_complete?(user, profile, kyc)
        return false unless profile
        return false unless tier3_complete?(user, profile, kyc)

        has_proof = profile.proof_of_address_type.present?
        has_proof_doc = profile.respond_to?(:proof_of_address) && profile.proof_of_address.attached?

        has_proof && has_proof_doc
      end
    end
  end

end
