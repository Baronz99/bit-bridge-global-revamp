# frozen_string_literal: true

require "net/http"
require "timeout"

module BootSafety
  class HttpBlockedError < StandardError; end

  class << self
    attr_accessor :http_guard_enabled
  end
end

BootSafety.http_guard_enabled = ENV["BOOT_HTTP_GUARD"] == "1"

module BootSafetyNetHttpGuard
  def request(*args, &block)
    if BootSafety.http_guard_enabled
      message = "Outbound HTTP blocked during boot. Move network calls to runtime."
      Rails.logger.error(message) if defined?(Rails) && Rails.logger
      raise BootSafety::HttpBlockedError, message
    end

    super
  end
end

Net::HTTP.prepend(BootSafetyNetHttpGuard)

Rails.application.config.after_initialize do
  BootSafety.http_guard_enabled = false if BootSafety.http_guard_enabled
end

if ENV["BOOT_CHECK"] == "1"
  begin
    Timeout.timeout(5) do
      ActiveRecord::Base.connection.execute("SELECT 1")
    end
  rescue Timeout::Error
    Rails.logger.error("Database connection timed out during boot.")
    raise "Database connection timed out during boot. Check DATABASE_URL and network access."
  rescue StandardError => e
    Rails.logger.error("Database connection failed during boot: #{e.class} #{e.message}")
    raise "Database connection failed during boot (#{e.class}). Check DATABASE_URL and credentials."
  end
end
