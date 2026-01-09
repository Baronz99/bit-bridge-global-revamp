# frozen_string_literal: true

class Tier3VerificationJob < ApplicationJob
  queue_as :default

  LIVENESS_MIN_CONFIDENCE = 0.90

  def perform(user_id, image_base64)
    user = User.find(user_id)
    kyc  = user.user_kyc

    unless kyc&.verified?
      return kyc&.update!(tier3_status: "rejected", tier3_error: "BVN must be verified before Tier 3")
    end

    bvn = kyc.bvn_encrypted.to_s.gsub(/\D/, "")
    if bvn.length != 11
      return kyc.update!(tier3_status: "rejected", tier3_error: "Verified BVN not available for Tier 3")
    end

    if image_base64.to_s.strip.blank?
      return kyc.update!(tier3_status: "failed", tier3_error: "image is required")
    end

    kyc.update!(
      tier3_status: "processing",
      tier3_error: nil,
      tier3_reference: nil,
      tier3_verified_at: nil
    )

    client = ::Kyc::PremblyTier3Biometrics.new

    # 1) Liveness
    liveness = client.liveness_check(image_base64)

    liveness_status = liveness.dig("verification", "status").to_s
    liveness_ref    = liveness.dig("verification", "reference").to_s
    liveness_conf   = liveness.dig("data", "confidence")
    liveness_conf   = liveness_conf.to_f if liveness_conf

    unless liveness_status.casecmp("VERIFIED").zero?
      return kyc.update!(
        tier3_status: "rejected",
        tier3_reference: liveness_ref.presence,
        tier3_error: "Liveness failed"
      )
    end

    if liveness_conf && liveness_conf.positive? && liveness_conf < LIVENESS_MIN_CONFIDENCE
      return kyc.update!(
        tier3_status: "rejected",
        tier3_reference: liveness_ref.presence,
        tier3_error: "Liveness confidence too low"
      )
    end

    # 2) BVN + Face match
    match = client.bvn_face_match(bvn, image_base64)

    match_ref   = match.dig("verification", "reference").to_s
    verify_stat = match.dig("verification", "status").to_s # e.g. VERIFIED / NOT VERIFIED
    top_status  = match["status"] # true/false
    resp_code   = match["response_code"].to_s
    msg         = match["message"].to_s.presence || match.dig("data", "message").to_s

    passed =
      (top_status == true) ||
      verify_stat.casecmp("VERIFIED").zero? ||
      (match.dig("data", "status") == true)

    if passed
      kyc.update!(
        tier3_status: "verified",
        tier3_reference: match_ref.presence || liveness_ref.presence,
        tier3_verified_at: Time.current,
        tier3_error: nil
      )
      user.update!(kyc_level: "tier_3")
    else
      pretty = msg.presence || "Face match failed"
      pretty = "#{pretty} [code=#{resp_code}]" if resp_code.present?

      kyc.update!(
        tier3_status: "rejected",
        tier3_reference: match_ref.presence || liveness_ref.presence,
        tier3_error: pretty
      )
    end
  rescue StandardError => e
    begin
      User.find_by(id: user_id)&.user_kyc&.update!(tier3_status: "failed", tier3_error: e.message)
    rescue StandardError
      nil
    end
    raise
  end
end
