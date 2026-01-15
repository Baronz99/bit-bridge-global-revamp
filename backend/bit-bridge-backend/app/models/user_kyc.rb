# frozen_string_literal: true

class UserKyc < ApplicationRecord
  belongs_to :user

  # Rails 7.1 Active Record Encryption (stores ciphertext in DB)
  encrypts :bvn_encrypted
  encrypts :bvn_snapshot_first_name,
           :bvn_snapshot_last_name,
           :bvn_snapshot_dob,
           :bvn_snapshot_reference

  def verified?
    bvn_status == "verified" && bvn_verified_at.present?
  end
end
