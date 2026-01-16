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
             :bvn_last_checked_at,
             :bvn_retry_attempt,
             :bvn_retry_next_at,
             :bvn_snapshot_first_name,
             :bvn_snapshot_last_name,
             :bvn_snapshot_dob,
             :bvn_snapshot_expires_at,
             :bvn_last_profile_fingerprint,
             :retry_events

  belongs_to :user

  def id
    object.id
  end

  def kyc_type
    return object.kyc_type if object.respond_to?(:kyc_type)
    "bvn"
  end

  def status
    return object.status if object.respond_to?(:status)
    object.bvn_status.to_s.presence || "mismatch"
  end

  def reason
    return object.reason if object.respond_to?(:reason)
    object.bvn_last_result_reason
  end

  def notes
    return object.notes if object.respond_to?(:notes)
    nil
  end

  def assigned_to_admin_id
    return object.assigned_to_admin_id if object.respond_to?(:assigned_to_admin_id)
    nil
  end

  def decided_by_admin_id
    return object.decided_by_admin_id if object.respond_to?(:decided_by_admin_id)
    nil
  end

  def decided_at
    return object.decided_at if object.respond_to?(:decided_at)
    nil
  end

  def created_at
    return object.created_at if object.respond_to?(:created_at) && !object.is_a?(UserKyc)
    object.bvn_last_checked_at || object.updated_at
  end

  def updated_at
    return object.updated_at if object.respond_to?(:updated_at) && !object.is_a?(UserKyc)
    object.bvn_last_checked_at || object.updated_at
  end

  def bvn_last4
    kyc_record&.bvn_last4
  end

  def bvn_last_result_status
    kyc_record&.bvn_last_result_status
  end

  def bvn_last_result_reason
    kyc_record&.bvn_last_result_reason
  end

  def bvn_last_checked_at
    kyc_record&.bvn_last_checked_at
  end

  def bvn_retry_attempt
    kyc_record&.bvn_retry_attempt
  end

  def bvn_retry_next_at
    kyc_record&.bvn_retry_next_at
  end

  def bvn_snapshot_first_name
    kyc_record&.bvn_snapshot_first_name
  end

  def bvn_snapshot_last_name
    kyc_record&.bvn_snapshot_last_name
  end

  def bvn_snapshot_dob
    kyc_record&.bvn_snapshot_dob
  end

  def bvn_snapshot_expires_at
    kyc_record&.bvn_snapshot_expires_at
  end

  def bvn_last_profile_fingerprint
    kyc_record&.bvn_last_profile_fingerprint
  end

  def retry_events
    kyc = kyc_record
    return [] unless kyc

    KycBvnRetryEvent.where(user_kyc_id: kyc.id)
                    .order(created_at: :desc)
                    .limit(10)
                    .map do |event|
      {
        attempt_number: event.attempt_number,
        status: event.status,
        reason: event.reason,
        next_wait_seconds: event.next_wait_seconds,
        provider_reference: event.provider_reference,
        created_at: event.created_at
      }
    end
  end

  def user
    object.is_a?(UserKyc) ? object.user : object.user
  end

  private

  def kyc_record
    object.is_a?(UserKyc) ? object : object.user&.user_kyc
  end
end
