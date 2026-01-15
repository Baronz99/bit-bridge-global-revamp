# app/serializers/user_kyc_serializer.rb
# frozen_string_literal: true

class UserKycSerializer < ActiveModel::Serializer
  attributes :bvn_status,
             :bvn_last4,
             :bvn_provider,
             :bvn_provider_reference,
             :bvn_verified_at,
             :bvn_name_match,
             :bvn_dob_match,
             :bvn_first_name_match,
             :bvn_last_name_match,
             :bvn_match_score,
             :bvn_last_result_status,
             :bvn_last_result_reason,
             :bvn_last_checked_at,
             :watchlisted,
             :bvn_attempts_count,
             :bvn_failed_attempts_count,
             :bvn_locked_until,
             :tier3_status,
             :tier3_reference,
             :tier3_verified_at,
             :tier3_error

  attribute :bvn_snapshot, if: :show_bvn_snapshot?

  def bvn_snapshot
    {
      first_name: object.bvn_snapshot_first_name,
      last_name: object.bvn_snapshot_last_name,
      dob: object.bvn_snapshot_dob,
      watchlisted: object.bvn_snapshot_watchlisted,
      reference: object.bvn_snapshot_reference,
      captured_at: object.bvn_snapshot_captured_at,
      expires_at: object.bvn_snapshot_expires_at
    }
  end

  def show_bvn_snapshot?
    scope.respond_to?(:super_admin?) && scope.super_admin?
  end
end
