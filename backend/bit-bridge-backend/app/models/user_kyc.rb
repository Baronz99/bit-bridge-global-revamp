# frozen_string_literal: true

class UserKyc < ApplicationRecord
  belongs_to :user

  # Rails 7.1 Active Record Encryption (stores ciphertext in DB)
  encrypts :bvn_encrypted
  encrypts :nin_encrypted
  encrypts :bvn_snapshot_first_name,
           :bvn_snapshot_last_name,
           :bvn_snapshot_dob,
           :bvn_snapshot_reference

  def assign_nin_identity!(raw_nin)
    normalized_nin = raw_nin.to_s.gsub(/\D/, '')
    self.nin_encrypted = normalized_nin
    self.nin_last4 = normalized_nin.last(4)
    self.nin_fingerprint = normalized_nin.present? ? Kyc::NinFingerprint.generate(normalized_nin) : nil
  end

  def verified?
    bvn_status == "verified" && bvn_verified_at.present?
  end

  def verified_and_reusable_bvn?
    verified? && bvn_identity_confirmed?
  end

  def bvn_identity_confirmed?
    bvn_encrypted.present?
  end

  def nin_verified?
    nin_status.to_s == "verified" || nin_verified_at.present?
  end

  # Canonical Tier 3 completion state:
  # treat verified_at as authoritative so stale status labels do not regress UI.
  def effective_tier3_status
    return "verified" if tier3_verified_at.present?

    tier3_status.to_s
  end

  def decrypted_bvn
    bvn_encrypted
  end
end
