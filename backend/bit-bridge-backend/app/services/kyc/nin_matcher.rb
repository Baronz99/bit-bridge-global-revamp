# frozen_string_literal: true

module Kyc
  module NinMatcher
    module_function

    def resolve_match_outcome(profile, result)
      return { status: "pending_review", reason: "profile_incomplete" } unless profile

      dob_match = Kyc::BvnMatcher.match_dob(profile.date_of_birth, result[:date_of_birth])
      last_name_match = Kyc::BvnMatcher.match_last_name(profile.last_name, result[:last_name])
      first_name_match = Kyc::BvnMatcher.match_first_name(profile.first_name, result[:first_name])

      watchlisted = Kyc::BvnMatcher.to_bool(result[:watchlisted])
      incomplete = result[:first_name].blank? || result[:last_name].blank? || result[:date_of_birth].blank?

      if watchlisted
        return { status: "pending_review", reason: "watchlisted", dob_match:, last_name_match:, first_name_match: }
      end

      if incomplete
        return { status: "pending_review", reason: "provider_incomplete", dob_match:, last_name_match:, first_name_match: }
      end

      if dob_match && last_name_match && first_name_match
        return { status: "verified", reason: nil, dob_match:, last_name_match:, first_name_match: }
      end

      if dob_match && last_name_match && !first_name_match
        return { status: "pending_review", reason: "name_mismatch", dob_match:, last_name_match:, first_name_match: }
      end

      { status: "mismatch", reason: "mismatch", dob_match:, last_name_match:, first_name_match: }
    end
  end
end

