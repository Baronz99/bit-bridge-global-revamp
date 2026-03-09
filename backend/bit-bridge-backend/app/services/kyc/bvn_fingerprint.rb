# frozen_string_literal: true

require_relative '../core/kyc/bvn_fingerprint'

module Kyc
  BvnFingerprint = Core::Kyc::BvnFingerprint unless const_defined?(:BvnFingerprint, false)
end
