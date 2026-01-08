# frozen_string_literal: true

require "rack/attack"

class Rack::Attack
  # Use Rails cache for throttling counters
  Rack::Attack.cache.store = Rails.cache

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
  # So throttle by IP and by card-id + IP for safety.

  # Very short burst limit (anti-spam / brute force UI hammering)
  throttle("cards/reveal/burst/ip", limit: 1, period: 3.seconds) do |req|
    if req.path.match?(%r{\A/api/v1/pci/cards/\d+/reveal\z}) && req.post?
      req.ip
    end
  end

  # Longer window limit (overall protection)
  throttle("cards/reveal/window/ip", limit: 30, period: 10.minutes) do |req|
    if req.path.match?(%r{\A/api/v1/pci/cards/\d+/reveal\z}) && req.post?
      req.ip
    end
  end

  # Optional: throttle per card id + ip (prevents hammering one card)
  throttle("cards/reveal/card/ip", limit: 10, period: 10.minutes) do |req|
    if req.path.match?(%r{\A/api/v1/pci/cards/\d+/reveal\z}) && req.post?
      # extract :id from /api/v1/pci/cards/:id/reveal
      card_record_id = req.path[%r{\A/api/v1/pci/cards/(\d+)/reveal\z}, 1]
      "#{card_record_id}:#{req.ip}" if card_record_id.present?
    end
  end
end
