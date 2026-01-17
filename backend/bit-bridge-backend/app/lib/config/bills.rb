# frozen_string_literal: true

require "uri"

module Config
  module Bills
    DEFAULT_NON_PROD_BASE_URL = "https://idev.buypower.ng/v2"
    CONFIRMATION_MODES = %w[sync async].freeze

    def self.base_url
      raw = ENV["BUYPOWER_BASE_URL"].to_s.strip
      if raw.empty?
        return DEFAULT_NON_PROD_BASE_URL unless Rails.env.production?

        raise RuntimeError, "Missing BUYPOWER_BASE_URL. Set BUYPOWER_BASE_URL to https://api.buypower.ng/v2 in production."
      end

      normalize_base_url(raw)
    end

    def self.token
      token = ENV["BUYPOWER_TOKEN"].to_s.strip
      raise RuntimeError, "Missing BUYPOWER_TOKEN. Set BUYPOWER_TOKEN to your BuyPower API token." if token.empty?

      token
    end

    def self.confirmation_mode
      mode = ENV["BILLS_CONFIRMATION_MODE"].to_s.strip
      mode = Rails.env.production? ? "async" : "sync" if mode.empty?
      mode = mode.downcase

      unless CONFIRMATION_MODES.include?(mode)
        raise RuntimeError, "Invalid BILLS_CONFIRMATION_MODE=#{mode.inspect}. Must be sync or async."
      end

      mode
    end

    def self.validate!
      token
      base_url
      confirmation_mode
      true
    end

    def self.normalize_base_url(value)
      uri = URI.parse(value)
      unless uri.is_a?(URI::HTTPS)
        raise RuntimeError, "Invalid BUYPOWER_BASE_URL=#{value.inspect}. Must start with https://"
      end
      raise RuntimeError, "Invalid BUYPOWER_BASE_URL=#{value.inspect}. Must not include a query string." if uri.query.present?

      path = uri.path.to_s
      path = path.chomp("/")
      if path.empty?
        path = "/v2"
      elsif !path.end_with?("/v2")
        path = "#{path}/v2"
      end
      uri.path = path
      uri.to_s
    rescue URI::InvalidURIError => e
      raise RuntimeError, "Invalid BUYPOWER_BASE_URL=#{value.inspect}. #{e.message}"
    end

    private_class_method :normalize_base_url
  end
end
