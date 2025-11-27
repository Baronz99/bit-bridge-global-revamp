# frozen_string_literal: true

require 'active_support/core_ext/integer/time'

Rails.application.routes.default_url_options = {
  host: 'bit-bridge-backend.onrender.com'
}

Rails.application.configure do
  # Settings specified here will take precedence over those in config/application.rb.

  # Reload app code on every request — good for development.
  config.enable_reloading = true

  # -----------------------------------------
  # FRONTEND URL FOR DEVELOPMENT
  # This makes password reset + confirmation emails point to local frontend.
  # -----------------------------------------
  config.x.frontend_url = 'http://localhost:5173'
  # (In production.rb, this will instead be https://bitbridgeglobal.com)
  # -----------------------------------------

  # SMTP mailer settings
  config.action_mailer.delivery_method = :smtp

  # Default host for Devise-generated links (dev environment only)
  config.action_mailer.default_url_options = { host: 'localhost', port: 3000 }

  config.action_mailer.smtp_settings = {
    address: 'smtp.hostinger.com',
    port: 587,
    user_name: 'support@bitbridgeglobal.com',
    password: '@Support-bitbridgeglobal-123',
    authentication: 'plain',
    enable_starttls_auto: true
  }

  # ✅ IMPORTANT: don’t break signup when SMTP times out
  config.action_mailer.raise_delivery_errors = false
  config.action_mailer.perform_deliveries    = true
  # (Emails are still *attempted*, but failures are logged instead of raising 500.)

  # Asset host for email images (if any)
  config.action_mailer.asset_host = 'http://localhost:3000'

  # Do not eager load code on boot.
  config.eager_load = false

  # Show full error reports.
  config.consider_all_requests_local = true

  # Enable server timing
  config.server_timing = true

  # Caching
  if Rails.root.join('tmp/caching-dev.txt').exist?
    config.cache_store = :memory_store
    config.public_file_server.headers = {
      'Cache-Control' => "public, max-age=#{2.days.to_i}"
    }
  else
    config.action_controller.perform_caching = false
    config.cache_store = :null_store
  end

  # Active Storage
  config.active_storage.service = :local

  # Mailer caching
  config.action_mailer.perform_caching = false

  # Deprecations
  config.active_support.deprecation = :log
  config.active_support.disallowed_deprecation = :raise
  config.active_support.disallowed_deprecation_warnings = []

  # Raise an error on page load for pending migrations.
  config.active_record.migration_error = :page_load

  # Highlight database queries in logs.
  config.active_record.verbose_query_logs = true

  # Highlight code that enqueued background jobs.
  config.active_job.verbose_enqueue_logs = true

  # Raise error when before_action references missing actions.
  config.action_controller.raise_on_missing_callback_actions = true

  # -----------------------------------------
  # MONNIFY – DEVELOPMENT (SANDBOX)
  # These values come from .env.development
  # -----------------------------------------
  config.x.monnify_api_key       = ENV.fetch('MONNIFY_API_KEY', nil)
  config.x.monnify_secret_key    = ENV.fetch('MONNIFY_SECRET_KEY', nil)
  config.x.monnify_base_url      = ENV.fetch('MONNIFY_BASE_URL', 'https://sandbox.monnify.com')
  config.x.monnify_contract_code = ENV.fetch('MONNIFY_CONTRACT_CODE', nil)
end
