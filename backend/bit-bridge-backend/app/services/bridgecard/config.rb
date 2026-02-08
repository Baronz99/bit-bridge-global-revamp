# frozen_string_literal: true

module Bridgecard
  class Config
    class Error < StandardError; end

    def self.env
      override = ENV['BRIDGECARD_ENV'].to_s.strip
      return override if override.present?

      Rails.env.production? ? 'live' : 'sandbox'
    end

    def self.env_name
      live? ? 'live' : 'sandbox'
    end

    def self.live?
      env.to_s.downcase == 'live'
    end

    def self.api_token
      token = token_value
      if live? && token.blank?
        raise Error, 'Bridgecard live token is missing'
      end
      if live? && token_sandbox_like?(token)
        raise Error, 'Bridgecard token appears to be sandbox while BRIDGECARD_ENV=live'
      end

      token
    end

    def self.token_source
      return 'BRIDGECARD_LIVE_TOKEN' if live? && ENV['BRIDGECARD_LIVE_TOKEN'].present?
      return 'BRIDGECARD_LIVE_SECRET' if live? && ENV['BRIDGECARD_LIVE_SECRET'].present?
      return 'BRIDGE_CARD_TOKEN' unless live? || ENV['BRIDGE_CARD_TOKEN'].blank?
      return 'BRIDGE_TOKEN' unless live? || ENV['BRIDGE_TOKEN'].blank?

      nil
    end

    def self.webhook_secrets
      if live?
        [
          ENV['BRIDGECARD_LIVE_WEBHOOK_SECRET'],
          ENV['BRIDGECARD_LIVE_SECRET']
        ].compact
      else
        [
          ENV['BRIDGECARD_TEST_WEBHOOK_SECRET']
        ].compact
      end
    end

    def self.issuing_id
      ENV['BRIDGECARD_ISSUING_ID']
    end

    def self.token_value
      if live?
        ENV['BRIDGECARD_LIVE_TOKEN'].presence ||
          ENV['BRIDGECARD_LIVE_SECRET'].presence
      else
        ENV['BRIDGE_CARD_TOKEN'].presence ||
          ENV['BRIDGE_TOKEN'].presence
      end
    end

    def self.debug_context
      {
        env_name: env_name,
        token_source: token_source,
        livemode_expected: live?
      }
    end

    def self.token_sandbox_like?(token)
      value = token.to_s.downcase
      return false if value.blank?

      value.include?('sandbox') || value.include?('test')
    end
  end
end
