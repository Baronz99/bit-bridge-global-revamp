# frozen_string_literal: true

class Tier3VerificationJob < ApplicationJob
  queue_as :default

  LIVENESS_MIN_CONFIDENCE = 0.90

  def perform(user_id, image_base64)
    user = User.find(user_id)
    kyc  = user.user_kyc

    return unless kyc

    # HARD STOP — never re-run once verified
    return if kyc.tier3_status == "verified"

    unless kyc.verified?
      return kyc.update!(tier3_status: "rejected", tier3_error: "BVN must be verified before Tier 3")
    end

    bvn = kyc.bvn_encrypted.to_s.gsub(/\D/, "")
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

    liveness_status = liveness.dig("verification", "status").to_s
    liveness_ref    = liveness.dig("verification", "reference").to_s
    liveness_conf   = liveness.dig("data", "confidence").to_f

    unless liveness_status.casecmp("VERIFIED").zero?
      return reject!(kyc, liveness_ref, "Liveness failed")
    end

    if liveness_conf.positive? && liveness_conf < LIVENESS_MIN_CONFIDENCE
      return reject!(kyc, liveness_ref, "Liveness confidence too low")
    end

    # ---------- FACE MATCH ----------
    match = client.bvn_face_match(bvn, image_base64)

    match_ref   = match.dig("verification", "reference").to_s
    verify_stat = match.dig("verification", "status").to_s
    top_status  = match["status"]
    resp_code   = match["response_code"].to_s
    msg         = match["message"].to_s.presence || match.dig("data", "message").to_s

    passed =
      top_status == true ||
      verify_stat.casecmp("VERIFIED").zero? ||
      match.dig("data", "status") == true

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
  rescue StandardError => e
    User.find_by(id: user_id)&.user_kyc&.update!(tier3_status: "failed", tier3_error: e.message)
    raise
  end

  private

  def reject!(kyc, ref, msg)
    kyc.with_lock do
      kyc.update!(
        tier3_status: "rejected",
        tier3_reference: ref.presence,
        tier3_error: msg
      )
    end
  end
end
