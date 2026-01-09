# frozen_string_literal: true

redis_url = ENV.fetch("REDIS_URL", "redis://127.0.0.1:6379/0")

ssl_params =
  if redis_url.start_with?("rediss://")
    # Heroku Redis uses TLS; allow verification using system CA bundle
    { verify_mode: OpenSSL::SSL::VERIFY_PEER }
  else
    nil
  end

Sidekiq.configure_server do |config|
  config.redis = { url: redis_url, ssl_params: ssl_params }.compact
end

Sidekiq.configure_client do |config|
  config.redis = { url: redis_url, ssl_params: ssl_params }.compact
end
