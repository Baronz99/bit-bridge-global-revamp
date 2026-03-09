# frozen_string_literal: true

require_relative '../core/kyc/bvn_snapshot_recheck'

module Kyc
  BvnSnapshotRecheck = Core::Kyc::BvnSnapshotRecheck unless const_defined?(:BvnSnapshotRecheck, false)
end
