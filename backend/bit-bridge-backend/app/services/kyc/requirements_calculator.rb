# frozen_string_literal: true

module Kyc
  class RequirementsCalculator
    def initialize(user)
      @user = user
    end

    def call
      profile = @user&.user_profile
      kyc = @user&.user_kyc

      has_first_name = profile.present? && profile.first_name.to_s.strip.present?
      has_last_name = profile.present? && profile.last_name.to_s.strip.present?
      has_phone_number = profile.present? && profile.phone_number.to_s.strip.present?
      has_phone_verified = profile&.phone_verified_at.present?
      has_date_of_birth = profile&.date_of_birth.present?

      tier1_ready = has_first_name && has_last_name && has_phone_number && has_phone_verified && has_date_of_birth
      bvn_verified = kyc&.bvn_status.to_s == "verified" || kyc&.bvn_verified_at.present?
      nin_verified = kyc&.nin_status.to_s == "verified" || kyc&.nin_verified_at.present?
      id_type_present = @user&.id_type.to_s.strip.present?
      has_id_document = profile.present? && profile.id_document.attached?
      identity_verified = has_id_document || nin_verified
      tier2_ready = tier1_ready && bvn_verified && id_type_present && identity_verified

      tier3_status = kyc&.tier3_status.to_s
      tier3_started = %w[pending processing verified failed].include?(tier3_status)
      tier3_verified = kyc&.tier3_verified_at.present? || tier3_status == "verified"
      tier3_ready = tier2_ready && tier3_verified

      address_complete =
        profile.present? &&
        profile.address_line1.to_s.strip.present? &&
        profile.city.to_s.strip.present? &&
        profile.state.to_s.strip.present? &&
        profile.country.to_s.strip.present?
      has_proof_of_address_type = profile.present? && profile.proof_of_address_type.to_s.strip.present?
      has_proof_of_address = profile.present? && profile.proof_of_address.attached?
      tier4_ready = tier3_ready && address_complete && has_proof_of_address_type && has_proof_of_address

      missing = build_missing(
        tier1_ready: tier1_ready,
        tier2_ready: tier2_ready,
        tier3_ready: tier3_ready,
        tier4_ready: tier4_ready,
        has_first_name: has_first_name,
        has_last_name: has_last_name,
        has_phone_number: has_phone_number,
        has_phone_verified: has_phone_verified,
        has_date_of_birth: has_date_of_birth,
        bvn_verified: bvn_verified,
        id_type_present: id_type_present,
        identity_verified: identity_verified,
        address_complete: address_complete,
        has_proof_of_address_type: has_proof_of_address_type,
        has_proof_of_address: has_proof_of_address
      )

      next_steps = next_steps_for(missing)

      {
        tier_current: @user&.kyc_level.presence || "tier_0",
        checks: {
          tier1_ready: tier1_ready,
          has_first_name: has_first_name,
          has_last_name: has_last_name,
          has_phone_number: has_phone_number,
          has_phone_verified: has_phone_verified,
          has_date_of_birth: has_date_of_birth,
          bvn_verified: bvn_verified,
          nin_verified: nin_verified,
          id_type_present: id_type_present,
          address_complete: address_complete,
          has_id_document: has_id_document,
          has_proof_of_address_type: has_proof_of_address_type,
          has_proof_of_address: has_proof_of_address,
          identity_verified: identity_verified,
          tier2_ready: tier2_ready,
          tier3_started: tier3_started,
          tier3_verified: tier3_verified,
          tier3_ready: tier3_ready,
          tier4_ready: tier4_ready
        },
        missing: missing,
        next_steps: next_steps
      }
    end

    private

    def build_missing(
      tier1_ready:,
      tier2_ready:,
      tier3_ready:,
      tier4_ready:,
      has_first_name:,
      has_last_name:,
      has_phone_number:,
      has_phone_verified:,
      has_date_of_birth:,
      bvn_verified:,
      id_type_present:,
      identity_verified:,
      address_complete:,
      has_proof_of_address_type:,
      has_proof_of_address:
    )
      missing = []

      unless tier1_ready
        missing << "first_name" unless has_first_name
        missing << "last_name" unless has_last_name
        missing << "phone_number" unless has_phone_number
        missing << "phone_verification" unless has_phone_verified
        missing << "date_of_birth" unless has_date_of_birth
        return missing
      end

      unless tier2_ready
        missing << "bvn" unless bvn_verified
        missing << "id_type" unless id_type_present
        missing << "identity" unless identity_verified
        return missing
      end

      unless tier3_ready
        missing << "tier3_biometrics"
        return missing
      end

      unless tier4_ready
        missing << "address" unless address_complete
        missing << "proof_of_address_type" unless has_proof_of_address_type
        missing << "proof_of_address" unless has_proof_of_address
      end

      missing
    end

    def next_steps_for(missing)
      steps = missing.map do |item|
        case item
        when "first_name"
          "Add your first name."
        when "last_name"
          "Add your last name."
        when "phone_number"
          "Add your phone number."
        when "phone_verification"
          "Verify your phone number with OTP."
        when "date_of_birth"
          "Add your date of birth."
        when "bvn"
          "Complete BVN verification."
        when "id_type"
          "Select an ID type."
        when "address"
          "Complete your address details."
        when "identity"
          "Upload an ID document or complete NIN verification."
        when "proof_of_address_type"
          "Select a proof of address type."
        when "proof_of_address"
          "Upload proof of address."
        when "tier3_biometrics"
          "Complete Tier 3 liveness verification."
        end
      end.compact

      steps
    end
  end
end
