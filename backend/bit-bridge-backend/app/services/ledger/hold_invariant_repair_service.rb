# frozen_string_literal: true

require_relative '../core/ledger/hold_invariant_repair_service'

module Ledger
  HoldInvariantRepairService = Core::Ledger::HoldInvariantRepairService unless const_defined?(:HoldInvariantRepairService, false)
end
