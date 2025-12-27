# frozen_string_literal: true

module Kyc
  class BvnFingerprint
    def self.generate(raw_bvn)
      secret = ENV['BVN_HMAC_SECRET'].presence || Rails.application.secret_key_base
      OpenSSL::HMAC.hexdigest('SHA256', secret, raw_bvn.to_s)
    end
  end
end
