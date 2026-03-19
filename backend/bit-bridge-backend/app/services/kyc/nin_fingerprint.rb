# frozen_string_literal: true

require_relative '../core/kyc/nin_fingerprint'

module Kyc
  NinFingerprint = Core::Kyc::NinFingerprint unless const_defined?(:NinFingerprint, false)
end
