# frozen_string_literal: true

module Core
  require "digest"

  module Kyc
    class BvnSnapshotRecheck
      ALLOWED_REASONS = %w[
        bvn_in_use
        watchlisted
        provider_incomplete
        profile_incomplete
        name_mismatch
        mismatch
        provider_unavailable
        locked_rate_limit
      ].freeze

      def self.call(user, bvn: nil, fingerprint: nil)
        return nil unless user

        kyc = user.user_kyc
        return nil unless kyc

        return nil if fingerprint.present? && kyc.bvn_fingerprint.present? && kyc.bvn_fingerprint != fingerprint
        return nil unless snapshot_available?(kyc)

        snapshot_result = {
          first_name: kyc.bvn_snapshot_first_name,
          last_name: kyc.bvn_snapshot_last_name,
          date_of_birth: kyc.bvn_snapshot_dob,
          watchlisted: kyc.bvn_snapshot_watchlisted,
          reference: kyc.bvn_snapshot_reference
        }

        outcome = ::Kyc::BvnMatcher.resolve_match_outcome(user.user_profile, snapshot_result)
        apply_outcome!(kyc, bvn, snapshot_result, outcome)
        update_last_result!(kyc, outcome, profile_fingerprint(user.user_profile))
        user.update!(kyc_level: Kyc::LevelCalculator.resolve_level(user))

        { status: kyc.bvn_status, reason: outcome[:reason], outcome: outcome }
      rescue StandardError => e
        Rails.logger.warn("[BVN] snapshot recheck failed #{e.class}: #{e.message}")
        nil
      end

      def self.snapshot_available?(kyc)
        return false unless kyc.bvn_fingerprint.present?
        return false unless kyc.bvn_snapshot_expires_at.present?
        return false if kyc.bvn_snapshot_expires_at < Time.current
        return false if kyc.bvn_snapshot_first_name.blank?
        return false if kyc.bvn_snapshot_last_name.blank?
        return false if kyc.bvn_snapshot_dob.blank?

        true
      end

      def self.apply_outcome!(kyc, bvn, result, outcome)
        score =
          [outcome[:dob_match], outcome[:last_name_match], outcome[:first_name_match]]
            .compact
            .map { |flag| flag ? 1 : 0 }
            .sum / 3.0

        kyc.assign_attributes(
          bvn_provider_reference: result[:reference],
          bvn_name_match: outcome[:first_name_match] && outcome[:last_name_match],
          bvn_dob_match: outcome[:dob_match],
          bvn_first_name_match: outcome[:first_name_match],
          bvn_last_name_match: outcome[:last_name_match],
          bvn_match_score: score.round(3),
          watchlisted: to_bool(result[:watchlisted])
        )

        case outcome[:status]
        when "verified"
          kyc.bvn_status = "verified"
          kyc.bvn_verified_at = Time.current
          kyc.bvn_failed_attempts_count = 0
          kyc.bvn_locked_until = nil
          kyc.bvn_encrypted = bvn if bvn.present?
        when "pending_review"
          kyc.bvn_status = "pending_review"
        else
          kyc.bvn_status = "mismatch"
        end

        kyc.save!
      end
      private_class_method :apply_outcome!

      def self.update_last_result!(kyc, outcome, profile_fingerprint)
        normalized_reason = normalize_reason(outcome[:status], outcome[:reason])
        kyc.update!(
          bvn_last_result_status: outcome[:status],
          bvn_last_result_reason: normalized_reason,
          bvn_last_checked_at: Time.current,
          bvn_last_profile_fingerprint: profile_fingerprint
        )
      end
      private_class_method :update_last_result!

      def self.normalize_reason(status, reason)
        key = reason.to_s.strip
        return nil if key.empty?
        return key if ALLOWED_REASONS.include?(key)

        status_key = status.to_s
        return "locked_rate_limit" if status_key == "locked"
        return "mismatch" if status_key == "mismatch"
        return "provider_incomplete" if status_key == "pending_review"

        nil
      end
      private_class_method :normalize_reason

      def self.profile_fingerprint(profile)
        return nil unless profile

        raw = [profile.first_name, profile.last_name, profile.date_of_birth]
              .map { |value| value.to_s.strip.downcase }
              .join("|")
        pepper = ENV["KYC_FINGERPRINT_PEPPER"].to_s
        pepper = Rails.application.secret_key_base if pepper.empty?
        Digest::SHA256.hexdigest("#{pepper}|#{raw}")
      end
      private_class_method :profile_fingerprint

      def self.to_bool(value)
        return true if value == true
        return false if value == false
        value.to_s.downcase == "true"
      end
      private_class_method :to_bool
    end
  end

end
