# frozen_string_literal: true

class PhoneVerificationCode < ApplicationRecord
  belongs_to :user

  # ---- Security + cost controls ----
  MAX_ATTEMPTS = 5
  TTL = 5.minutes

  # Base cooldown between sends (we also add backoff below)
  RESEND_COOLDOWN = 45.seconds

  # Hard caps (cost guardrails)
  MAX_SENDS_PER_10_MIN_PER_USER  = 3
  MAX_SENDS_PER_DAY_PER_USER     = 10
  MAX_SENDS_PER_10_MIN_PER_PHONE = 3
  MAX_SENDS_PER_DAY_PER_PHONE    = 5

  scope :recent, -> { order(last_sent_at: :desc, created_at: :desc) }

  def expired?
    expires_at.present? && Time.current >= expires_at
  end

  # Exponential backoff based on send_count (keeps it cheap)
  # 1st resend: 45s, 2nd: 60s, 3rd: 120s, 4th+: 10min
  def resend_cooldown_seconds
    c = send_count.to_i
    return RESEND_COOLDOWN.to_i if c <= 1
    return 60  if c == 2
    return 120 if c == 3
    600
  end

  def can_resend?
    return true if last_sent_at.nil?
    (Time.current - last_sent_at) >= resend_cooldown_seconds
  end

  def lock!
    update!(status: "blocked")
  end

  # ---- Class helpers for enforcing caps ----
  # IMPORTANT: enforce by last_sent_at, not created_at, because we might create records early
  # or reuse records in older flows.
  def self.within(window)
    where("COALESCE(last_sent_at, created_at) >= ?", Time.current - window)
  end

  def self.sent_count_for_user(user_id, window:)
    where(user_id: user_id).within(window).count
  end

  def self.sent_count_for_phone(phone_e164, window:)
    where(phone_e164: phone_e164).within(window).count
  end

  def self.allowed_to_send?(user_id:, phone_e164:)
    user_10m  = sent_count_for_user(user_id, window: 10.minutes)
    user_day  = sent_count_for_user(user_id, window: 24.hours)
    phone_10m = sent_count_for_phone(phone_e164, window: 10.minutes)
    phone_day = sent_count_for_phone(phone_e164, window: 24.hours)

    return false if user_10m  >= MAX_SENDS_PER_10_MIN_PER_USER
    return false if user_day  >= MAX_SENDS_PER_DAY_PER_USER
    return false if phone_10m >= MAX_SENDS_PER_10_MIN_PER_PHONE
    return false if phone_day >= MAX_SENDS_PER_DAY_PER_PHONE

    true
  end
end
