# frozen_string_literal: true

require_relative '../core/ledger/processing_hold_reconcile_service'

module Ledger
  ProcessingHoldReconcileService = Core::Ledger::ProcessingHoldReconcileService unless const_defined?(:ProcessingHoldReconcileService, false)
end
