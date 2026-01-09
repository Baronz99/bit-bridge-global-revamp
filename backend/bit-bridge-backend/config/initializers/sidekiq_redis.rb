# frozen_string_literal: true

return unless ENV["REDIS_URL"].present?

# Heroku Redis uses TLS (rediss://). Some plans/providers present a chain that can fail strict verification.
# For internal-only staging, we disable verification to keep Sidekiq running.
# If you want strict verification later, switch VERIFY_NONE -> VERIFY_PEER.
ssl_params = { verify_mode: OpenSSL::SSL::VERIFY_NONE }

Sidekiq.configure_server do |config|
  config.redis = { url: ENV.fetch("REDIS_URL"), ssl_params: ssl_params }
end

Sidekiq.configure_client do |config|
  config.redis = { url: ENV.fetch("REDIS_URL"), ssl_params: ssl_params }
end
