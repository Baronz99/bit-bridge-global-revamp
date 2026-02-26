# frozen_string_literal: true

class Tier3VerificationJob < ApplicationJob
  queue_as :default

  LIVENESS_MIN_CONFIDENCE = 0.90
  SUCCESS_VERIFY_STATUSES = %w[VERIFIED PASSED SUCCESS SUCCESSFUL].freeze
  RETRYABLE_PROVIDER_CODES = %w[02 429 500 502 503 504].freeze
  REJECTED_VERIFY_STATUSES = %w[FAILED REJECTED ERROR].freeze
  class ProviderTemporarilyUnavailableError < StandardError; end

  retry_on ProviderTemporarilyUnavailableError, wait: 2.minutes, attempts: 3

  def perform(user_id, image_base64)
    user = User.find(user_id)
    kyc  = user.user_kyc

    return unless kyc

    # HARD STOP — never re-run once verified
    return if kyc.tier3_status == "verified"

    unless kyc.verified?
      return kyc.update!(tier3_status: "rejected", tier3_error: "BVN must be verified before Tier 3")
    end

    raw_bvn = kyc.decrypted_bvn
    bvn = raw_bvn.to_s.gsub(/\D/, "")
    if bvn.length != 11
      return kyc.update!(tier3_status: "rejected", tier3_error: "Verified BVN not available for Tier 3")
    end

    if image_base64.to_s.strip.blank?
      return kyc.update!(tier3_status: "failed", tier3_error: "image is required")
    end

    # Lock row — prevents race conditions & double charge
    kyc.with_lock do
      return if kyc.tier3_status == "verified"

      kyc.update!(
        tier3_status: "processing",
        tier3_error: nil,
        tier3_reference: nil,
        tier3_verified_at: nil
      )
    end

    client = ::Kyc::PremblyTier3Biometrics.new

    # ---------- LIVENESS ----------
    liveness = client.liveness_check(image_base64)

    liveness_verify_stat = verification_status_for(liveness)
    liveness_ref        = liveness.dig("verification", "reference").to_s
    liveness_conf       = liveness.dig("data", "confidence").to_f
    liveness_msg        = response_message_for(liveness)
    liveness_code       = response_code_for(liveness)

    Rails.logger.warn("[Tier3] LIVENESS code=#{liveness_code.inspect} verify_status=#{liveness_verify_stat.inspect} ref=#{liveness_ref.inspect} conf=#{liveness_conf} msg=#{liveness_msg.inspect}")

    # Provider downtime / endpoint unavailable should be RETRYABLE, not "rejected"
    if provider_unavailable?(liveness_code, liveness_msg)
      return fail_retryable!(kyc, liveness_ref, "Face liveness is temporarily unavailable. Please try again in a few minutes. [code=#{liveness_code.presence || 'N/A'}]")
    end

    liveness_passed = success_payload?(liveness)

    unless liveness_passed
      pretty = liveness_msg.presence || "Liveness failed"
      pretty = "#{pretty} [code=#{liveness_code}]" if liveness_code.present?
      return reject!(kyc, liveness_ref, pretty)
    end

    if liveness_conf.positive? && liveness_conf < LIVENESS_MIN_CONFIDENCE
      return reject!(kyc, liveness_ref, "Liveness confidence too low (#{liveness_conf.round(3)}). Please retry with better lighting.")
    end

    # ---------- FACE MATCH ----------
    match = client.bvn_face_match(bvn, image_base64)

    match_ref   = match.dig("verification", "reference").to_s
    verify_stat = verification_status_for(match)
    resp_code   = response_code_for(match)
    msg         = response_message_for(match)

    Rails.logger.warn("[Tier3] FACE_MATCH code=#{resp_code.inspect} verify_status=#{verify_stat.inspect} ref=#{match_ref.inspect} msg=#{msg.inspect}")

    # Treat "unavailable" / provider issues here as retryable too
    if provider_unavailable?(resp_code, msg)
      return fail_retryable!(kyc, match_ref.presence || liveness_ref.presence, "Face match is temporarily unavailable. Please try again. [code=#{resp_code.presence || 'N/A'}]")
    end

    passed = success_payload?(match)

    if passed
      kyc.with_lock do
        kyc.update!(
          tier3_status: "verified",
          tier3_reference: match_ref.presence || liveness_ref.presence,
          tier3_verified_at: Time.current,
          tier3_error: nil
        )
        user.update!(kyc_level: "tier_3")
      end
    else
      pretty = msg.presence || "Face match failed"
      pretty = "#{pretty} [code=#{resp_code}]" if resp_code.present?
      reject!(kyc, match_ref.presence || liveness_ref.presence, pretty)
    end
  rescue ProviderTemporarilyUnavailableError
    raise
  rescue StandardError => e
    # network errors, unexpected parsing errors, etc = retryable fail
    User.find_by(id: user_id)&.user_kyc&.update!(
      tier3_status: "failed",
      tier3_error: "Tier 3 verification failed: #{e.message}"
    )
    raise
  end

  private

  # Provider temporarily unavailable -> retryable (failed), not rejected
  def provider_unavailable?(code, msg)
    c = code.to_s.strip
    m = msg.to_s.downcase

    return true if RETRYABLE_PROVIDER_CODES.include?(c)
    return true if m.include?("unavailable")
    return true if m.include?("temporarily")
    return true if m.include?("try again")
    return true if m.include?("service") && m.include?("down")

    false
  end

  def fail_retryable!(kyc, ref, msg)
    kyc.with_lock do
      kyc.update!(
        tier3_status: "failed",
        tier3_reference: ref.presence,
        tier3_error: msg
      )
    end
    raise ProviderTemporarilyUnavailableError, msg
  end

  def reject!(kyc, ref, msg)
    kyc.with_lock do
      kyc.update!(
        tier3_status: "rejected",
        tier3_reference: ref.presence,
        tier3_error: msg
      )
    end
  end

  def response_code_for(payload)
    payload["response_code"].to_s.presence ||
      payload.dig("data", "response_code").to_s.presence ||
      payload.dig("verification", "response_code").to_s.presence ||
      ""
  end

  def response_message_for(payload)
    payload["message"].to_s.presence ||
      payload["detail"].to_s.presence ||
      payload["error"].to_s.presence ||
      payload.dig("data", "message").to_s.presence ||
      payload.dig("data", "error").to_s.presence ||
      payload.dig("verification", "message").to_s.presence ||
      ""
  end

  def verification_status_for(payload)
    payload.dig("verification", "status").to_s.upcase
  end

  def success_payload?(payload)
    verify_status = verification_status_for(payload)
    return true if SUCCESS_VERIFY_STATUSES.include?(verify_status)
    return false if REJECTED_VERIFY_STATUSES.include?(verify_status)

    return true if payload["status"] == true
    return true if payload.dig("data", "status") == true

    false
  end
end
