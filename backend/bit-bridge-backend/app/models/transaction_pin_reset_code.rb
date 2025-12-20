# app/models/transaction_pin_reset_code.rb
class TransactionPinResetCode < ApplicationRecord
  TTL = 10.minutes
  MAX_ATTEMPTS = 5
  COOLDOWN = 45.seconds
  MAX_SENDS_PER_WINDOW = 3
  SEND_WINDOW = 15.minutes

  belongs_to :user

  def expired?
    expires_at.present? && Time.current > expires_at
  end

  def can_resend?
    return true if last_sent_at.blank?
    Time.current - last_sent_at >= COOLDOWN
  end

  def lock!
    update!(status: "blocked")
  end

  # hard cap (cost guardrails), like your PhoneVerificationCode.allowed_to_send?
  def self.allowed_to_send?(user_id:, phone_e164:)
    window_start = Time.current - SEND_WINDOW
    count = where(user_id: user_id, phone_e164: phone_e164)
      .where("created_at >= ?", window_start)
      .sum(:send_count)

    count < MAX_SENDS_PER_WINDOW
  end
end
