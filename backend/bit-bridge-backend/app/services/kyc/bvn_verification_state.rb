# frozen_string_literal: true

module Kyc
  class BvnVerificationState
    class MissingReusableBvnError < StandardError; end

    def self.mark_verified!(user_kyc, raw_bvn: nil, verified_at: Time.current)
      raise ArgumentError, 'user_kyc is required' if user_kyc.blank?

      normalized_bvn = normalize_bvn(raw_bvn).presence || normalize_bvn(user_kyc.bvn_encrypted).presence
      raise MissingReusableBvnError, 'Verified BVN must be reusable.' if normalized_bvn.blank?

      user_kyc.update!(
        bvn_status: 'verified',
        bvn_verified_at: verified_at,
        bvn_failed_attempts_count: 0,
        bvn_locked_until: nil,
        bvn_encrypted: normalized_bvn
      )
    end

    def self.normalize_bvn(raw_bvn)
      digits = raw_bvn.to_s.gsub(/\D/, '')
      return nil unless digits.length == 11

      digits
    end
    private_class_method :normalize_bvn
  end
end
