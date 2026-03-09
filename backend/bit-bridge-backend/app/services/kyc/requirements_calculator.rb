# frozen_string_literal: true

require_relative '../core/kyc/requirements_calculator'

module Kyc
  RequirementsCalculator = Core::Kyc::RequirementsCalculator unless const_defined?(:RequirementsCalculator, false)
end
