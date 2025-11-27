# frozen_string_literal: true

require 'active_support/core_ext/integer/time'

# Default URL options used when Rails builds URLs (e.g. in mailers, url_helpers)
Rails.application.routes.default_url_options = {
  host: 'bitbridgeglobal-fa54ecb89f7d.herokuapp.com',
  protocol: 'https'
}

Rails.application.configure do
  # ================================
  # FRONTEND URL FOR LIVE APP
  # Used in UserMailer for password reset & confirmation links
  # e.g. https://bitbridgeglobal.com/reset_password?...
  # ================================
  config.x.frontend_url = 'https://bitbridgeglobal.com'

  # Where email templates should load images/assets from
  # (for asset_host-based URLs in emails if needed)
  config.action_mailer.asset_host = 'https://bitbridgeglobal-fa54ecb89f7d.herokuapp.com'

  # SMTP mailer configuration
  config.action_mailer.delivery_method = :smtp

  # Host used when Rails itself generates URLs in mailers (Devise, etc.)
  config.action_mailer.default_url_options = {
    host: 'bitbridgeglobal.com',
    protocol: 'https'
  }

  config.action_mailer.smtp_settings = {
    address: 'smtp.hostinger.com',
    port: 587,
    user_name: 'support@bitbridgeglobal.com',
    password: '@Support-bitbridgeglobal-123',
    authentication: 'plain',
    enable_starttls_auto: true
  }

  # Code is not reloaded between requests in production.
  config.enable_reloading = false

  # Eager load code on boot.
  config.eager_load = true

  # Full error reports are disabled and caching is turned on.
  config.consider_all_requests_local = false

  # Serve static files if env flags are present (Heroku/Render)
  config.public_file_server.enabled =
    ENV['RAILS_SERVE_STATIC_FILES'].present? || ENV['RENDER'].present?

  # Store uploaded files in S3 (configured in config/storage.yml)
  config.active_storage.service = :amazon

  # Force all access to the app over SSL and use secure cookies.
  config.force_ssl = true

  # Log to STDOUT by default (Heroku style)
  config.logger = ActiveSupport::Logger.new($stdout)
                                       .tap  { |logger| logger.formatter = ::Logger::Formatter.new }
                                       .then { |logger| ActiveSupport::TaggedLogging.new(logger) }

  # Prepend all log lines with request ID tags.
  config.log_tags = [:request_id]

  # Log level (info by default, configurable via ENV)
  config.log_level = ENV.fetch('RAILS_LOG_LEVEL', 'info')

  # Use a real queuing backend for Active Job in production if configured.
  # config.active_job.queue_adapter = :resque
  # config.active_job.queue_name_prefix = "bit_bridge_backend_production"

  config.action_mailer.perform_caching = false

  # I18n fallbacks for missing translations.
  config.i18n.fallbacks = true

  # Don't log any deprecations.
  config.active_support.report_deprecations = false

  # Do not dump schema after migrations.
  config.active_record.dump_schema_after_migration = false

  # Host protection (can be customized if needed)
  # config.hosts = [
  #   "bitbridgeglobal.com",
  #   "bitbridgeglobal-fa54ecb89f7d.herokuapp.com"
  # ]
  # config.host_authorization = { exclude: ->(request) { request.path == "/up" } }
end
