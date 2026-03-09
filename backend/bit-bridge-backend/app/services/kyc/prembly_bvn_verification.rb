# frozen_string_literal: true

require_relative '../core/kyc/prembly_bvn_verification'

module Kyc
  PremblyBvnVerification = Core::Kyc::PremblyBvnVerification unless const_defined?(:PremblyBvnVerification, false)
end
