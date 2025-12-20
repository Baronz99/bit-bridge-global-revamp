# frozen_string_literal: true

require "rack/attack"

class Rack::Attack
  Rack::Attack.cache.store = Rails.cache

  throttle("otp/request/ip", limit: 10, period: 1.hour) do |req|
    req.ip if req.path == "/api/v1/phone_verification/request" && req.post?
  end

  throttle("otp/verify/ip", limit: 30, period: 1.hour) do |req|
    req.ip if req.path == "/api/v1/phone_verification/verify" && req.post?
  end
end
