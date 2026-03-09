# frozen_string_literal: true

require_relative '../core/service_availability/snapshot_builder'

module ServiceAvailability
  SnapshotBuilder = Core::ServiceAvailability::SnapshotBuilder unless const_defined?(:SnapshotBuilder, false)
end
