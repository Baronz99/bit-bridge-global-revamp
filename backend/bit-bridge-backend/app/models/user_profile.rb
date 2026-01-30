# frozen_string_literal: true

class UserProfile < ApplicationRecord
  belongs_to :user

  validates :phone_number, uniqueness: true, allow_blank: true
  validates :gender, inclusion: { in: %w[male female], allow_nil: true, allow_blank: true }

  has_one_attached :id_document
  has_one_attached :proof_of_address

  before_save :sync_phone_verification_state_if_phone_changed

  private

  def sync_phone_verification_state_if_phone_changed
    return unless will_save_change_to_phone_number?

    old_phone_raw, new_phone_raw = saved_change_to_phone_number
    old_phone_raw = old_phone_raw.to_s.strip
    new_phone_raw = new_phone_raw.to_s.strip

    # If phone removed/blank → clear verification fields
    if new_phone_raw.blank?
      self.phone_verified_at = nil if respond_to?(:phone_verified_at=)
      self.phone_e164 = nil if respond_to?(:phone_e164=)
      return
    end

    # If we are explicitly setting phone_verified_at in this same save (verification flow),
# do not override it here.
if will_save_change_to_phone_verified_at? && phone_verified_at.present?
  return
end


    # Normalize old & new phones (best effort)
    old_e164 =
      begin
        old_phone_raw.present? ? PhoneNormalizer.to_e164_ng(old_phone_raw) : phone_e164
      rescue StandardError
        phone_e164
      end

    new_e164 =
      begin
        PhoneNormalizer.to_e164_ng(new_phone_raw)
      rescue StandardError
        nil
      end

    self.phone_e164 = new_e164 if respond_to?(:phone_e164=) && new_e164.present?

    # ✅ IMPORTANT: preserve history of previously verified phones
    # If we are moving away from a verified phone, ensure it exists in history table as "verified"
    if respond_to?(:phone_verified_at) && phone_verified_at.present? && old_e164.present? && defined?(PhoneVerificationCode)
      PhoneVerificationCode.find_or_create_by!(user_id: user_id, phone_e164: old_e164) do |pvc|
        pvc.status = "verified"
        pvc.expires_at = Time.current # irrelevant for verified history
        pvc.send_count = 0
        pvc.attempts = 0
        pvc.last_sent_at = Time.current
      end

      # If it already exists but isn’t marked verified (legacy), upgrade it
      PhoneVerificationCode.where(user_id: user_id, phone_e164: old_e164).where.not(status: "verified").update_all(status: "verified")
    end

    # ✅ Restore verification if this new phone was verified before
    previously_verified =
      new_e164.present? &&
      defined?(PhoneVerificationCode) &&
      PhoneVerificationCode.exists?(user_id: user_id, phone_e164: new_e164, status: "verified")

    if previously_verified
      self.phone_verified_at = Time.current if respond_to?(:phone_verified_at=)
    else
      self.phone_verified_at = nil if respond_to?(:phone_verified_at=)
      self.phone_e164 = nil if respond_to?(:phone_e164=) && new_e164.blank?
    end
  end

end
