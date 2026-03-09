# frozen_string_literal: true

require_relative '../core/kyc/prembly_bvn_basic_validation'

module Kyc
  PremblyBvnBasicValidation = Core::Kyc::PremblyBvnBasicValidation unless const_defined?(:PremblyBvnBasicValidation, false)
end
