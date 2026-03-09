# frozen_string_literal: true

require_relative '../core/kyc/prembly_nin_verification'

module Kyc
  PremblyNinVerification = Core::Kyc::PremblyNinVerification unless const_defined?(:PremblyNinVerification, false)
end
