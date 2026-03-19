# frozen_string_literal: true

module Core
  module Kyc
    class NinFingerprint
      def self.generate(raw_nin)
        secret = ENV['NIN_HMAC_SECRET'].presence || Rails.application.secret_key_base
        OpenSSL::HMAC.hexdigest('SHA256', secret, raw_nin.to_s)
      end
    end
  end
end
