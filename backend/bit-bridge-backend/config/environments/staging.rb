# config/environments/staging.rb
require "active_support/core_ext/integer/time"

Rails.application.configure do
  # Very similar to production
  config.cache_classes = true
  config.eager_load = true

  config.consider_all_requests_local = false
  config.action_controller.perform_caching = true

  config.log_level = :info

  # Set this to your staging host later
  config.action_controller.default_url_options = { host: "staging-api.bitbridgeglobal.com", protocol: "https" }

  # Assets / static files
  config.public_file_server.enabled = ENV["RAILS_SERVE_STATIC_FILES"].present?

    # === Monnify / payment config for staging ===
  # For now we point staging at sandbox. You can override via ENV if you like.
  config.x.monnify_base_url      = ENV.fetch('MONNIFY_BASE_URL', 'https://sandbox.monnify.com')
  config.x.monnify_api_key       = ENV['MONNIFY_API_KEY']
  config.x.monnify_secret_key    = ENV['MONNIFY_SECRET_KEY']
  config.x.monnify_contract_code = ENV['MONNIFY_CONTRACT_CODE']


  # Active Storage / mailer / etc – you can mirror production config here
  # or keep using your existing production.rb as a reference.

    # 📧 Mailer config for local staging
  # Use test delivery, so Devise can "send" emails without SMTP
  # and we still see the full email (with confirmation link) in the logs.
  config.action_mailer.default_url_options = { host: 'localhost', port: 4000 }

  config.action_mailer.delivery_method    = :test
  config.action_mailer.perform_deliveries = true
  config.action_mailer.raise_delivery_errors = false

end
