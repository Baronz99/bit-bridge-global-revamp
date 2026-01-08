# frozen_string_literal: true

require "rack/attack"

class Rack::Attack
  # Use Rails cache for throttling counters
  Rack::Attack.cache.store = Rails.cache

  # Return JSON for API throttles (prevents HTML responses)
  self.throttled_responder = lambda do |request|
    retry_after = (request.env["rack.attack.match_data"] || {})[:period]
    body = {
      message: "Too many requests. Please slow down.",
      retry_after_seconds: retry_after
    }.to_json

    [
      429,
      {
        "Content-Type" => "application/json",
        "Cache-Control" => "no-store",
        "Retry-After" => retry_after.to_s
      },
      [body]
    ]
  end

  # -------------------------
  # OTP throttles (existing)
  # -------------------------
  throttle("otp/request/ip", limit: 10, period: 1.hour) do |req|
    req.ip if req.path == "/api/v1/phone_verification/request" && req.post?
  end

  throttle("otp/verify/ip", limit: 30, period: 1.hour) do |req|
    req.ip if req.path == "/api/v1/phone_verification/verify" && req.post?
  end

  # -------------------------
  # PCI card reveal throttles
  # -------------------------
  # NOTE:
  # In Rack middleware you cannot reliably access current_user.
  # So throttle by IP and by (card record id + IP).

  # Match /api/v1/pci/cards/:id/reveal where :id could be UUID
  REVEAL_PATH_REGEX = %r{\A/api/v1/pci/cards/([0-9a-fA-F-]{36})/reveal\z}.freeze

  # Very short burst limit (anti-spam / UI hammering)
  throttle("cards/reveal/burst/ip", limit: 1, period: 3.seconds) do |req|
    if req.post? && req.path.match?(REVEAL_PATH_REGEX)
      req.ip
    end
  end

  # Longer window limit (overall protection)
  throttle("cards/reveal/window/ip", limit: 30, period: 10.minutes) do |req|
    if req.post? && req.path.match?(REVEAL_PATH_REGEX)
      req.ip
    end
  end

  # Per card id + ip (prevents hammering one card)
  throttle("cards/reveal/card/ip", limit: 10, period: 10.minutes) do |req|
    next unless req.post?

    match = req.path.match(REVEAL_PATH_REGEX)
    next unless match

    card_record_id = match[1]
    "#{card_record_id}:#{req.ip}" if card_record_id.present?
  end
end
