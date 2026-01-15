# frozen_string_literal: true

class KycReviewSerializer < ActiveModel::Serializer
  attributes :id,
             :kyc_type,
             :status,
             :reason,
             :notes,
             :assigned_to_admin_id,
             :decided_by_admin_id,
             :decided_at,
             :created_at,
             :updated_at,
             :bvn_last4,
             :bvn_last_result_status,
             :bvn_last_result_reason,
             :bvn_snapshot_first_name,
             :bvn_snapshot_last_name,
             :bvn_snapshot_dob,
             :bvn_snapshot_expires_at,
             :bvn_last_profile_fingerprint

  belongs_to :user

  def bvn_last4
    user_kyc&.bvn_last4
  end

  def bvn_last_result_status
    user_kyc&.bvn_last_result_status
  end

  def bvn_last_result_reason
    user_kyc&.bvn_last_result_reason
  end

  def bvn_snapshot_first_name
    user_kyc&.bvn_snapshot_first_name
  end

  def bvn_snapshot_last_name
    user_kyc&.bvn_snapshot_last_name
  end

  def bvn_snapshot_dob
    user_kyc&.bvn_snapshot_dob
  end

  def bvn_snapshot_expires_at
    user_kyc&.bvn_snapshot_expires_at
  end

  def bvn_last_profile_fingerprint
    user_kyc&.bvn_last_profile_fingerprint
  end

  def user_kyc
    object.user&.user_kyc
  end
end
