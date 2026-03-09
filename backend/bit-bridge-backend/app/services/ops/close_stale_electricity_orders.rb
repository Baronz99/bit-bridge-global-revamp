# frozen_string_literal: true

require_relative '../core/ops/close_stale_electricity_orders'

module Ops
  CloseStaleElectricityOrders = Core::Ops::CloseStaleElectricityOrders unless const_defined?(:CloseStaleElectricityOrders, false)
end
