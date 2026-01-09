# frozen_string_literal: true

require "httparty"
require "base64"

module Kyc
  class PremblyTier3Biometrics
    include HTTParty
    base_uri "https://api.prembly.com"

    # Accept multiple env names to avoid "works in BVN but not Tier3"
    API_KEY_ENV_CANDIDATES = %w[
      PREMBLY_API_KEY
      PREMBLY_SECRET_KEY
      PREMBLY_KEY
      PREMBLT_API_KEY
    ].freeze

    APP_ID_ENV_CANDIDATES = %w[
      PREMBLY_APP_ID
      PREMBLY_APPID
      PREMBLY_CLIENT_ID
    ].freeze

    def initialize(logger: Rails.logger)
      raise StandardError, "PREMBLY is disabled" unless FeatureFlags.prembly?

      @logger = logger

      @api_key, @api_key_source = fetch_env(API_KEY_ENV_CANDIDATES)
      @app_id,  @app_id_source  = fetch_env(APP_ID_ENV_CANDIDATES)

      # Log what the running process sees (masked)
      @logger.warn("[Tier3] Prembly env api_key_source=#{@api_key_source.inspect} api_key_present=#{present?(@api_key)} api_key_sample=#{mask(@api_key)}")
      @logger.warn("[Tier3] Prembly env app_id_source=#{@app_id_source.inspect} app_id_present=#{present?(@app_id)} app_id_value=#{@app_id.inspect}")

      raise StandardError, "PREMBLY_API_KEY is missing (tried: #{API_KEY_ENV_CANDIDATES.join(', ')})" unless present?(@api_key)
      raise StandardError, "PREMBLY_APP_ID is missing (tried: #{APP_ID_ENV_CANDIDATES.join(', ')})" unless present?(@app_id)
    end

    # Returns parsed JSON hash, raises on HTTP errors
    def liveness_check(image_input)
      post_json(
        "/verification/biometrics/face/liveliness_check",
        { image: normalize_image_base64(image_input) }
      )
    end

    # Returns parsed JSON hash, raises on HTTP errors
    def bvn_face_match(bvn_number, image_input)
      post_json(
        "/verification/bvn_w_face",
        { number: bvn_number.to_s, image: normalize_image_base64(image_input) }
      )
    end

    private

    def headers
      {
        "x-api-key" => @api_key,
        "app-id" => @app_id,
        "Content-Type" => "application/json"
      }
    end

    def post_json(path, body_hash)
      response = self.class.post(
        path,
        headers: headers,
        body: body_hash.to_json,
        timeout: 25
      )

      parsed = response.parsed_response
      parsed = {} unless parsed.is_a?(Hash)

      if response.code.to_i >= 400
        msg =
          parsed["message"] ||
          parsed["error"] ||
          parsed.dig("data", "message") ||
          parsed.dig("data", "error") ||
          "Prembly request failed"

        # Add response_code if present (Prembly often includes it)
        resp_code = parsed["response_code"] || parsed.dig("data", "response_code")
        msg = "#{msg} [code=#{resp_code}]" if resp_code

        raise StandardError, "#{msg} (HTTP #{response.code})"
      end

      parsed
    rescue Net::OpenTimeout, Net::ReadTimeout => e
      raise StandardError, "Prembly request timeout: #{e.class}"
    end

    # IMPORTANT:
    # Prembly expects a base64 string in these endpoints.
    # - Accepts raw base64
    # - Accepts data URL and strips prefix
    # - Rejects plain http(s) URL early with a clear error
    def normalize_image_base64(value)
      str = value.to_s.strip
      raise StandardError, "image is required" if str.empty?

      # data:image/jpeg;base64,....
      if str.include?("base64,")
        str = str.split("base64,", 2).last.to_s.strip
      end

      if str.start_with?("http://", "https://")
        raise StandardError, "Invalid request data: image must be base64 (not a URL)."
      end

      # Minimal sanity check: base64 chars only (allow newlines)
      candidate = str.gsub(/\s+/, "")
      unless candidate.match?(/\A[A-Za-z0-9+\/=]+\z/)
        raise StandardError, "Invalid request data: image must be base64."
      end

      # Optional: try decode to ensure it's valid base64
      begin
        Base64.decode64(candidate)
      rescue StandardError
        raise StandardError, "Invalid request data: image base64 is not decodable."
      end

      candidate
    end

    # Returns [value, source_key]
    def fetch_env(keys)
      keys.each do |k|
        raw = ENV[k]
        next if raw.nil?

        val = normalize_env_value(raw)
        return [val, k] if present?(val)
      end
      ["", nil]
    end

    def normalize_env_value(value)
      v = value.to_s.strip

      # Handle accidental wrapping quotes: "live_sk_..." or 'live_sk_...'
      if (v.start_with?('"') && v.end_with?('"')) || (v.start_with?("'") && v.end_with?("'"))
        v = v[1..-2].to_s.strip
      end

      return "" if v.empty?
      return "" if %w[nil null none undefined].include?(v.downcase)

      v
    end

    def present?(value)
      value.to_s.strip != ""
    end

    def mask(secret)
      s = secret.to_s
      return "" if s.empty?
      return "***" if s.length < 8
      "#{s[0, 4]}...#{s[-3, 3]}"
    end
  end
end
