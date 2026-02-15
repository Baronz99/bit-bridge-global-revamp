# frozen_string_literal: true

require 'bigdecimal'

module Bridgecard
  class FxRateFetcher
    class Error < StandardError; end

    ENDPOINT = 'https://issuecards.api.bridgecard.co/v1/issuing/cards/fx-rate'
    RATE_KEY = 'NGN-USD'
    # Console helper: Bridgecard::FxRateFetcher.call

    def self.call(setting: FxSetting.current)
      new(setting: setting).call
    end

    def initialize(setting:)
      @setting = setting
    end

    def call
      token = Bridgecard::Config.api_token
      raise Error, 'Bridgecard token is missing' if token.blank?

      response = HTTParty.get(
        ENDPOINT,
        headers: {
          'token' => "Bearer #{token}",
          'Content-Type' => 'application/json',
          'Accept' => 'application/json'
        },
        timeout: 10,
        open_timeout: 5
      )

      status_code = response.respond_to?(:code) ? response.code.to_i : nil
      log_response(status_code, response)

      case status_code
      when 401, 403
        raise Error, 'Bridgecard authorization failed (check token/environment)'
      when 429
        raise Error, 'Bridgecard rate limited'
      when 500..599
        raise Error, 'Bridgecard provider unavailable'
      end

      raise Error, 'Bridgecard FX feed unavailable' unless response.respond_to?(:success?) && response.success?

      body = response.parsed_response
      raise Error, 'Bridgecard FX response parsing failed' unless body.is_a?(Hash)

      data = body['data']
      raw_value = data.is_a?(Hash) ? data[RATE_KEY] : nil
      raise Error, 'Bridgecard FX rate missing' if raw_value.blank?

      divisor = @setting.provider_fx_divisor.to_i
      divisor = 100 if divisor <= 0
      raw_int = Integer(raw_value)
      raw_decimal = BigDecimal(raw_int.to_s)
      computed_rate = (raw_decimal / divisor).round(6)
      validate_rate!(computed_rate)

      @setting.update!(
        provider_raw: raw_int,
        provider_usd_ngn_rate: computed_rate,
        provider_source: 'bridgecard',
        provider_updated_at: Time.current,
        base_usd_ngn_rate: (bridgecard_base_lock_enabled? ? computed_rate : @setting.base_usd_ngn_rate)
      )

      {
        raw: raw_int,
        divisor: divisor,
        computed_rate: computed_rate,
        as_of: @setting.provider_updated_at&.iso8601,
        source: @setting.provider_source,
        pair: RATE_KEY
      }
    rescue Bridgecard::Config::Error => e
      raise Error, e.message
    rescue Error
      raise
    rescue ArgumentError, TypeError
      raise Error, "Bridgecard FX rate invalid: #{raw_value.inspect}"
    rescue JSON::ParserError
      raise Error, 'Bridgecard FX response parsing failed'
    rescue StandardError => e
      raise Error, e.message
    end

    def log_response(status_code, response)
      body = response.respond_to?(:body) ? response.body : nil
      snippet =
        if body.is_a?(String)
          body[0, 300]
        elsif body.present?
          body.to_s[0, 300]
        end

      Rails.logger.info(
        "[BridgecardFxRateFetcher] status=#{status_code} env=#{Bridgecard::Config.env_name} endpoint=#{ENDPOINT}"
      )

      return if snippet.blank?

      Rails.logger.info("[BridgecardFxRateFetcher] body_snippet=#{snippet}")
    end

    def validate_rate!(computed_rate)
      return if computed_rate.to_d.positive? && computed_rate.to_d < 1_000_000

      raise Error, "Bridgecard FX rate out of range: #{computed_rate}"
    end

    def bridgecard_base_lock_enabled?
      ENV['FX_BASE_RATE_SOURCE'].to_s.casecmp('bridgecard').zero? ||
        ActiveModel::Type::Boolean.new.cast(ENV['FX_BASE_RATE_BRIDGECARD_LOCK'])
    end
  end
end
