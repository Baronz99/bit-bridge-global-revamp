# frozen_string_literal: true

module Core
  require "httparty"

  module Kyc
    class PremblyBvnBasicValidation
      include HTTParty

      base_uri "https://api.prembly.com"
      format :json

      def initialize(bvn)
        @bvn = bvn.to_s
      end

      def call
        unless FeatureFlags.prembly?
          raise StandardError, "PREMBLY is disabled"
        end

        api_key = ENV["PREMBLY_API_KEY"].to_s
        app_id = ENV["PREMBLY_APP_ID"].to_s
        if api_key.blank?
          raise StandardError, "PREMBLY_API_KEY is missing"
        end
        if app_id.blank?
          raise StandardError, "PREMBLY_APP_ID is missing"
        end

        response = self.class.post(
          "/verification/bvn_validation",
          headers: {
            "x-api-key" => api_key,
            "app-id" => app_id,
            "Content-Type" => "application/json",
            "Accept" => "application/json"
          },
          body: { number: @bvn }.to_json,
          timeout: 15
        )

        parsed = parse_response(response)
        status_code = response.code.to_i
        if status_code >= 400
          invalid = [400, 422].include?(status_code)
          invalid ||= invalid_payload?(parsed)
          return { ok: false, error: parsed, status_code: status_code, invalid: invalid }
        end

        invalid = invalid_payload?(parsed)
        return { ok: false, error: parsed, status_code: status_code, invalid: true } if invalid

        { ok: true }
      rescue StandardError => e
        Rails.logger.warn("[BVN] Prembly basic exception #{e.class}: #{e.message}")
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
    end
  end

end
