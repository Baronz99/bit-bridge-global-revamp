# frozen_string_literal: true

require_relative '../core/ops/repair_stale_unprocessable_bill_orders'

module Ops
  RepairStaleUnprocessableBillOrders = Core::Ops::RepairStaleUnprocessableBillOrders unless const_defined?(:RepairStaleUnprocessableBillOrders, false)
end
