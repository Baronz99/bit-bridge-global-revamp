# frozen_string_literal: true

require "digest"

module Kyc
  class BvnRetryJob < ApplicationJob
    MAX_ATTEMPTS = 6
    BACKOFF_SCHEDULE = [120, 240, 480, 900, 1800].freeze
    LOCK_TIMEOUT = 5.minutes

    def perform(user_kyc_id, fingerprint)
      kyc = UserKyc.find_by(id: user_kyc_id)
      return unless kyc
      return unless kyc.bvn_status.to_s == "pending"
      return if kyc.bvn_fingerprint.present? && kyc.bvn_fingerprint != fingerprint
      return unless acquire_lock!(kyc)

      begin
        attempt = kyc.bvn_retry_attempt.to_i + 1
        kyc.update!(bvn_retry_attempt: attempt, bvn_retry_next_at: nil)
        record_event(kyc, attempt, "started", nil, nil, nil)

        bvn = kyc.decrypted_bvn.to_s
        unless bvn.match?(/\A\d{11}\z/)
          log_retry(kyc, attempt, "failed", "bvn_missing", nil)
          record_event(kyc, attempt, "failed", "bvn_missing", nil, nil)
          mark_retry_timeout!(kyc, reason: "bvn_missing")
          return
        end

        result = ::Kyc::PremblyBvnVerification.new(bvn).call
        unless result[:ok]
          reschedule_or_timeout!(kyc, fingerprint, attempt)
          return
        end

        user = kyc.user
        outcome = ::Kyc::BvnMatcher.resolve_match_outcome(user.user_profile, result)
        apply_outcome!(kyc, bvn, result, outcome)
        store_snapshot!(kyc, result)
        update_last_result!(kyc, outcome, profile_fingerprint(user.user_profile))
        user.update!(kyc_level: ::Kyc::LevelCalculator.resolve_level(user))
        clear_retry_state!(kyc)
        log_retry(kyc, attempt, kyc.bvn_status, outcome[:reason], nil)
        record_event(kyc, attempt, kyc.bvn_status, outcome[:reason], nil, result[:reference])
      ensure
        release_lock!(kyc)
      end
    end

    private

    def reschedule_or_timeout!(kyc, fingerprint, attempt)
      if attempt >= MAX_ATTEMPTS
        log_retry(kyc, attempt, "failed", "provider_unavailable_timeout", nil)
        record_event(kyc, attempt, "failed", "provider_unavailable_timeout", nil, nil)
        mark_retry_timeout!(kyc, reason: "provider_unavailable_timeout")
        return
      end

      next_wait = BACKOFF_SCHEDULE.fetch(attempt - 1, BACKOFF_SCHEDULE.last)
      update_last_result!(kyc, { status: "failed", reason: "provider_unavailable" }, profile_fingerprint(kyc.user.user_profile))
      kyc.update!(bvn_retry_next_at: Time.current + next_wait)
      log_retry(kyc, attempt, "failed", "provider_unavailable", next_wait)
      record_event(kyc, attempt, "retry_scheduled", "provider_unavailable", next_wait, nil)
      self.class.set(wait: next_wait.seconds).perform_later(kyc.id, fingerprint)
    end

    def mark_retry_timeout!(kyc, reason:)
      kyc.update!(bvn_status: "unverified")
      update_last_result!(kyc, { status: "failed", reason: reason }, profile_fingerprint(kyc.user.user_profile))
      clear_retry_state!(kyc)
    end

    def acquire_lock!(kyc)
      cutoff = Time.current - LOCK_TIMEOUT
      updated = UserKyc.where(id: kyc.id)
                       .where("bvn_retry_locked_at IS NULL OR bvn_retry_locked_at < ?", cutoff)
                       .update_all(bvn_retry_locked_at: Time.current)
      updated == 1
    end

    def release_lock!(kyc)
      kyc.update_columns(bvn_retry_locked_at: nil)
    rescue StandardError
      nil
    end

    def clear_retry_state!(kyc)
      kyc.update!(
        bvn_retry_attempt: 0,
        bvn_retry_next_at: nil
      )
    end

    def log_retry(kyc, attempt, status, reason, next_wait)
      Rails.logger.info("[BVN] retry kyc_id=#{kyc.id} attempt=#{attempt} status=#{status} reason=#{reason} next_wait=#{next_wait}")
    end

    def record_event(kyc, attempt, status, reason, next_wait, reference)
      KycBvnRetryEvent.create!(
        user_id: kyc.user_id,
        user_kyc_id: kyc.id,
        attempt_number: attempt,
        status: status,
        reason: reason,
        next_wait_seconds: next_wait,
        provider_reference: reference,
        created_at: Time.current
      )
    rescue StandardError
      nil
    end

    def apply_outcome!(kyc, bvn, result, outcome)
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

    def store_snapshot!(kyc, result)
      return unless snapshot_fields_present?(result)

      kyc.update!(
        bvn_snapshot_first_name: normalize_snapshot_name(result[:first_name]),
        bvn_snapshot_last_name: normalize_snapshot_name(result[:last_name]),
        bvn_snapshot_dob: normalize_snapshot_dob(result[:date_of_birth]),
        bvn_snapshot_watchlisted: to_bool(result[:watchlisted]),
        bvn_snapshot_reference: result[:reference].to_s.presence,
        bvn_snapshot_captured_at: Time.current,
        bvn_snapshot_expires_at: Time.current + 60.days
      )
    end

    def snapshot_fields_present?(result)
      result[:first_name].present? && result[:last_name].present? && result[:date_of_birth].present?
    end

    def normalize_snapshot_name(value)
      trimmed = value.to_s.strip
      trimmed.presence
    end

    def normalize_snapshot_dob(value)
      parsed = parse_prembly_dob(value)
      parsed ? parsed.iso8601 : nil
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

    def update_last_result!(kyc, outcome, profile_fingerprint)
      normalized_reason = normalize_reason(outcome[:status], outcome[:reason])
      kyc.update!(
        bvn_last_result_status: outcome[:status],
        bvn_last_result_reason: normalized_reason,
        bvn_last_checked_at: Time.current,
        bvn_last_profile_fingerprint: profile_fingerprint
      )
    end

    def normalize_reason(status, reason)
      key = reason.to_s.strip
      return nil if key.empty?
      return key if %w[
        bvn_in_use watchlisted provider_incomplete profile_incomplete name_mismatch mismatch
        cached_mismatch cached_pending_review provider_unavailable locked_rate_limit
        provider_unavailable_timeout bvn_missing bvn_invalid
      ].include?(key)

      status_key = status.to_s
      return "locked_rate_limit" if status_key == "locked"
      return "mismatch" if status_key == "mismatch"
      return "provider_incomplete" if status_key == "pending_review"

      nil
    end

    def profile_fingerprint(profile)
      return nil unless profile

      raw = [profile.first_name, profile.last_name, profile.date_of_birth]
            .map { |value| value.to_s.strip.downcase }
            .join("|")
      pepper = ENV["KYC_FINGERPRINT_PEPPER"].to_s
      pepper = Rails.application.secret_key_base if pepper.empty?
      Digest::SHA256.hexdigest("#{pepper}|#{raw}")
    end

    def to_bool(value)
      return true if value == true
      return false if value == false
      value.to_s.downcase == "true"
    end
  end
end
