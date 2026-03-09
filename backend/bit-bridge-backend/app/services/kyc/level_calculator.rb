# frozen_string_literal: true

require_relative '../core/kyc/level_calculator'

module Kyc
  LevelCalculator = Core::Kyc::LevelCalculator unless const_defined?(:LevelCalculator, false)
end
