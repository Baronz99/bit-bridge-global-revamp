# frozen_string_literal: true

module Fx
  module Providers
    class ExchangeRateApiFetcher
      class Error < StandardError; end

      ENDPOINT = 'https://open.er-api.com/v6/latest/USD'

      def self.call(setting: FxSetting.current)
        new(setting: setting).call
      end

      def initialize(setting:)
        @setting = setting
      end

      def call
        response = HTTParty.get(
          ENDPOINT,
          headers: { 'Accept' => 'application/json' },
          timeout: 10,
          open_timeout: 5
        )

        status_code = response.respond_to?(:code) ? response.code.to_i : nil
        body = response.parsed_response

        unless response.respond_to?(:success?) && response.success?
          message = "Provider unavailable (status #{status_code})"
          persist_error(message)
          raise Error, message
        end

        raise Error, 'Provider response parsing failed' unless body.is_a?(Hash)

        if body['result'].present? && body['result'] != 'success'
          message = body['error-type'].presence || 'Provider returned error result'
          persist_error(message)
          raise Error, message
        end

        base_code = body['base_code'].to_s
        rates = body['rates']
        raise Error, 'Provider base_code missing' if base_code.blank?
        raise Error, 'Provider rates missing' unless rates.is_a?(Hash)

        normalized_rates = normalize_rates(rates)
        raise Error, 'Provider rates empty' if normalized_rates.empty?

        @setting.update!(
          provider_source: 'exchangerate_api',
          provider_base: base_code,
          provider_rates: normalized_rates,
          provider_as_of: body['time_last_update_utc'].presence,
          provider_updated_at: Time.current,
          provider_error: nil
        )

        {
          source: @setting.provider_source,
          base: @setting.provider_base,
          as_of: @setting.provider_as_of,
          updated_at: @setting.provider_updated_at&.iso8601,
          rates_preview: preview_rates(@setting.provider_rates)
        }
      rescue Error
        raise
      rescue StandardError => e
        persist_error(e.message)
        raise Error, e.message
      end

      def derived_rate_to_usd(code)
        raw = @setting.provider_rates.to_h[code]
        return nil if raw.blank?

        (1.to_d / raw.to_d).round(8)
      end

      private

      def normalize_rates(rates)
        rates.each_with_object({}) do |(code, value), memo|
          next if code.blank?
          decimal = BigDecimal(value.to_s) rescue nil
          next if decimal.nil? || decimal <= 0

          memo[code.to_s.upcase] = decimal.to_f
        end
      end

      def preview_rates(rates)
        keys = %w[NGN EUR GBP CAD KES GHS ZAR JPY AUD CNY]
        rates.slice(*keys)
      end

      def persist_error(message)
        @setting.update!(
          provider_error: message.to_s.first(200),
          provider_updated_at: Time.current
        )
      rescue StandardError
        nil
      end
    end
  end
end
