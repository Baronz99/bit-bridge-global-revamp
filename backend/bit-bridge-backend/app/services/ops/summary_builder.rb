# frozen_string_literal: true

require_relative '../core/ops/summary_builder'

module Ops
  SummaryBuilder = Core::Ops::SummaryBuilder unless const_defined?(:SummaryBuilder, false)
end
