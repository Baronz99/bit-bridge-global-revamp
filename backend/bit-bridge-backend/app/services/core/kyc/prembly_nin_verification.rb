# frozen_string_literal: true

module Core
  require "httparty"

  module Kyc
    class PremblyNinVerification
      include HTTParty

      base_uri "https://api.prembly.com"
      format :json

      def initialize(nin)
        @nin = nin.to_s
      end

      def call
        unless FeatureFlags.prembly?
          raise StandardError, "PREMBLY is disabled"
        end

        api_key = ENV["PREMBLY_API_KEY"].to_s
        app_id = ENV["PREMBLY_APP_ID"].to_s
        raise StandardError, "PREMBLY_API_KEY is missing" if api_key.blank?
        raise StandardError, "PREMBLY_APP_ID is missing" if app_id.blank?

        response = self.class.post(
          "/verification/vnin-basic",
          headers: {
            "x-api-key" => api_key,
            "app-id" => app_id,
            "Content-Type" => "application/json",
            "Accept" => "application/json"
          },
          body: { number: @nin }.to_json,
          timeout: 15
        )

        parsed = parse_response(response)
        status_code = response.code.to_i
        if status_code >= 400
          invalid = [400, 404, 422].include?(status_code) || invalid_payload?(parsed)
          return { ok: false, error: parsed, status_code: status_code, invalid: invalid }
        end

        data = parsed.is_a?(Hash) ? parsed : {}
        container = data["data"] || data["result"] || data["response"] || data["verification"] || data
        payload =
          if container.is_a?(Hash) && container["nin_data"].is_a?(Hash)
            container["nin_data"]
          else
            container
          end

        if invalid_payload?(data) || invalid_payload?(container) || invalid_payload?(payload)
          return { ok: false, error: parsed, status_code: status_code, invalid: true }
        end

        {
          ok: true,
          reference: extract_reference(data, container, payload),
          first_name: fetch_value(payload, %w[firstName first_name firstname given_name givenname]),
          last_name: fetch_value(payload, %w[lastName last_name lastname surname sur_name]),
          middle_name: fetch_value(payload, %w[middleName middle_name middlename other_name]),
          date_of_birth: fetch_value(payload, %w[dateOfBirth dob date_of_birth birthdate birth_date]),
          phone_number: fetch_value(payload, %w[phoneNumber phone_number phone]),
          watchlisted: fetch_value(payload, %w[watchListed watchlisted is_watchlisted])
        }
      rescue StandardError => e
        Rails.logger.warn("[NIN] Prembly exception #{e.class}: #{e.message}")
        { ok: false, error: e.message, status_code: 500, invalid: false }
      end

      private

      def parse_response(response)
        parsed = response.parsed_response
        return parsed if parsed.present?

        body = response.body.to_s
        stripped = body.strip
        return JSON.parse(stripped) if stripped.start_with?("{", "[")

        body
      rescue StandardError
        response.body.to_s
      end

      def invalid_payload?(payload)
        return false unless payload.is_a?(Hash)

        status_value = payload["status"]
        return false unless status_value == false || status_value.to_s.downcase == "false"

        message = payload["message"].to_s.downcase
        message.include?("invalid") || message.include?("not found")
      end

      def extract_reference(top_level, container, payload)
        fetch_value(top_level, %w[reference reference_id verificationReference verification_reference ref]) ||
          fetch_value(container, %w[reference reference_id verificationReference verification_reference ref]) ||
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
