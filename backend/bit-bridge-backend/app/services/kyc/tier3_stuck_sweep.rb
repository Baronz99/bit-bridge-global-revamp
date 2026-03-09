# frozen_string_literal: true

require_relative '../core/kyc/tier3_stuck_sweep'

module Kyc
  Tier3StuckSweep = Core::Kyc::Tier3StuckSweep unless const_defined?(:Tier3StuckSweep, false)
end
