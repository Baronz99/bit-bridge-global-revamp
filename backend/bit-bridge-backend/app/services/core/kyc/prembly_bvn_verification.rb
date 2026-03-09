# frozen_string_literal: true

module Core
  require 'httparty'

  module Kyc
    class PremblyBvnVerification
      include HTTParty

      base_uri 'https://api.prembly.com'

      def initialize(bvn)
        @bvn = bvn.to_s
      end

      def call
        unless FeatureFlags.prembly?
          raise StandardError, 'PREMBLY is disabled'
        end

        api_key = ENV['PREMBLY_API_KEY'].to_s
        app_id = ENV['PREMBLY_APP_ID'].to_s
        if api_key.blank?
          raise StandardError, 'PREMBLY_API_KEY is missing'
        end
        if app_id.blank?
          raise StandardError, 'PREMBLY_APP_ID is missing'
        end

        response = self.class.post(
          '/verification/bvn_validation',
          headers: {
            'x-api-key' => api_key,
            'app-id' => app_id,
            'Content-Type' => 'application/json'
          },
          body: { number: @bvn }.to_json,
          timeout: 15
        )

        parsed = response.parsed_response
        if response.code.to_i >= 400
          Rails.logger.warn(
            "[BVN] Prembly error http=#{response.code.to_i} body=#{parsed.inspect}"
          )
          return { ok: false, error: parsed, status_code: response.code.to_i }
        end

        data = parsed.is_a?(Hash) ? parsed : {}
        payload = data['data'] || data['result'] || data['response'] || data['verification'] || data

        {
          ok: true,
          reference: extract_reference(data, payload),
          first_name: fetch_value(payload, %w[firstName first_name firstname]),
          last_name: fetch_value(payload, %w[lastName last_name lastname]),
          middle_name: fetch_value(payload, %w[middleName middle_name middlename]),
          date_of_birth: fetch_value(payload, %w[dateOfBirth dob date_of_birth]),
          phone_number: fetch_value(payload, %w[phoneNumber1 phone_number phone]),
          watchlisted: fetch_value(payload, %w[watchListed watchlisted])
        }
      rescue StandardError => e
        Rails.logger.warn("[BVN] Prembly exception #{e.class}: #{e.message}")
        { ok: false, error: e.message, status_code: 500 }
      end

      private

      def extract_reference(top_level, payload)
        fetch_value(top_level, %w[reference reference_id verificationReference verification_reference ref]) ||
          fetch_value(payload, %w[reference reference_id verificationReference verification_reference ref])
      end

      def fetch_value(hash, keys)
        return nil unless hash.is_a?(Hash)

        keys.each do |key|
          return hash[key] if hash.key?(key)
        end
        nil
      end
    end
  end

end
