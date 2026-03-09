# frozen_string_literal: true

require_relative '../core/kyc/bvn_matcher'

module Kyc
  BvnMatcher = Core::Kyc::BvnMatcher unless const_defined?(:BvnMatcher, false)
end
