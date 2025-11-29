# config/environments/staging.rb
require "active_support/core_ext/integer/time"

Rails.application.configure do
  # Similar to production for performance
  config.cache_classes = true
  config.eager_load = true

  config.consider_all_requests_local = false
  config.action_controller.perform_caching = true

  config.log_level = :info

  # IMPORTANT: Replace this later with your Render backend domain when deployed
  config.action_controller.default_url_options = {
    host: ENV.fetch("STAGING_BACKEND_HOST", "localhost"),
    protocol: "https"
  }

  # -------------------------------
  # 🌐 ASSET & STATIC FILES
  # -------------------------------
  config.public_file_server.enabled = ENV["RAILS_SERVE_STATIC_FILES"].present?

  # -------------------------------
  # 💾 ACTIVE STORAGE (AWS S3 staging bucket)
  # -------------------------------
  config.active_storage.service = :amazon

  # -------------------------------
  # 💳 MONNIFY (SANDBOX ONLY)
  # -------------------------------
  config.x.monnify_base_url      = ENV.fetch("MONNIFY_BASE_URL", "https://sandbox.monnify.com")
  config.x.monnify_api_key       = ENV["MONNIFY_API_KEY"]
  config.x.monnify_secret_key    = ENV["MONNIFY_SECRET_KEY"]
  config.x.monnify_contract_code = ENV["MONNIFY_CONTRACT_CODE"]
  config.x.monnify_wallet_account_number = ENV["MONNIFY_WALLET_ACCOUNT_NUMBER"]

  # -------------------------------
  # 📧 MAILER (MAILTRAP FOR STAGING)
  # -------------------------------
  config.action_mailer.default_url_options = {
    host: ENV.fetch("STAGING_FRONTEND_HOST", "localhost:5173"),
    protocol: "https"
  }

  config.action_mailer.delivery_method = :smtp
  config.action_mailer.smtp_settings = {
    address: "smtp.mailtrap.io",
    port: 2525,
    user_name: ENV["SMTP_USERNAME"],  # Mailtrap username
    password: ENV["SMTP_PASSWORD"],   # Mailtrap password
    authentication: :plain
  }

  config.action_mailer.perform_deliveries = true
  config.action_mailer.raise_delivery_errors = true

end
