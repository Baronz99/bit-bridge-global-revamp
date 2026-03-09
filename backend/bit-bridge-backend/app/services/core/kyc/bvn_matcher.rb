# frozen_string_literal: true

module Core
  module Kyc
    module BvnMatcher
      module_function

      def resolve_match_outcome(profile, result)
        return { status: "pending_review", reason: "profile_incomplete" } unless profile

        dob_match = match_dob(profile.date_of_birth, result[:date_of_birth])
        last_name_match = match_last_name(profile.last_name, result[:last_name])
        first_name_match = match_first_name(profile.first_name, result[:first_name])

        watchlisted = to_bool(result[:watchlisted])
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

      def match_first_name(profile_value, provider_value)
        profile_norm = normalize_name(profile_value)
        provider_norm = normalize_name(provider_value)

        return false if profile_norm.blank? || provider_norm.blank?
        return true if profile_norm == provider_norm

        profile_tokens = profile_norm.split
        provider_tokens = provider_norm.split
        (profile_tokens & provider_tokens).any?
      end

      def match_last_name(profile_value, provider_value)
        profile_norm = normalize_name(profile_value)
        provider_norm = normalize_name(provider_value)

        return false if profile_norm.blank? || provider_norm.blank?
        return true if profile_norm == provider_norm

        profile_compact = compact_name(profile_value)
        provider_compact = compact_name(provider_value)
        return true if profile_compact.present? && profile_compact == provider_compact

        profile_tokens = profile_norm.split
        provider_tokens = provider_norm.split
        (profile_tokens & provider_tokens).any?
      end

      def normalize_name(value)
        value.to_s.downcase.gsub(/[^a-z\s]/, " ").split.join(" ")
      end

      def compact_name(value)
        value.to_s.downcase.gsub(/[^a-z]/, "")
      end

      def match_dob(profile_dob, provider_dob)
        return false if profile_dob.blank? || provider_dob.blank?

        parsed = parse_prembly_dob(provider_dob)
        return false unless parsed

        profile_date = profile_dob.is_a?(Date) ? profile_dob : Date.parse(profile_dob.to_s)
        profile_date == parsed
      rescue StandardError
        false
      end

      def parse_prembly_dob(value)
        raw = value.to_s.strip
        return nil if raw.blank?

        Date.strptime(raw, "%d-%b-%Y")
      rescue StandardError
        begin
          Date.parse(raw)
        rescue StandardError
          nil
        end
      end

      def to_bool(value)
        return true if value == true
        return false if value == false
        value.to_s.downcase == "true"
      end
    end
  end

end
