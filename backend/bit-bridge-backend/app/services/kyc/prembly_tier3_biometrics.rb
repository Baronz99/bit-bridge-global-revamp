# frozen_string_literal: true

require_relative '../core/kyc/prembly_tier3_biometrics'

module Kyc
  PremblyTier3Biometrics = Core::Kyc::PremblyTier3Biometrics unless const_defined?(:PremblyTier3Biometrics, false)
end
