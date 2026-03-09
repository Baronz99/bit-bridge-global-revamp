# frozen_string_literal: true

require_relative '../core/kyc/nin_matcher'

module Kyc
  NinMatcher = Core::Kyc::NinMatcher unless const_defined?(:NinMatcher, false)
end
