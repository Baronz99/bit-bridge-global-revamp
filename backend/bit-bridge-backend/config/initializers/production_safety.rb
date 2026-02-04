# frozen_string_literal: true

module ProductionSafety
  FORBIDDEN_FLAGS = %w[
    ALLOW_ANCHOR_UNSIGNED_WEBHOOKS
    ENABLE_ADMIN_CARD_DEBUG
    BRIDGE_CARDS_SANDBOX
  ].freeze

  CRITICAL_SECRETS = %w[
    JWT_SECRET
    AUTH_REFRESH_TOKEN_HMAC_SECRET
    BVN_HMAC_SECRET
    KYC_FINGERPRINT_PEPPER
  ].freeze

  def self.truthy?(value)
    value.present? && %w[true 1 yes on].include?(value.to_s.strip.downcase)
  end

  def self.ensure!
    return unless Rails.env.production?

    forbidden = forbidden_flags
    raise "Forbidden production flags enabled: #{forbidden.join(', ')}" if forbidden.any?

    wildcard = ENV.any? do |key, val|
      key.to_s.match?(/_SANDBOX$/i) && truthy?(val) ||
        key.to_s.match?(/_DEBUG$/i) && truthy?(val)
    end

    raise 'Sandbox/debug flags must be disabled in production' if wildcard

    missing = critical_secrets.select { |key| ENV[key].to_s.strip.empty? }
    raise "Missing critical secrets: #{missing.join(', ')}" if missing.any?

    ensure_anchor_webhook!
    ensure_bridge_cards_secrets!
    ensure_monnify_credentials!
  end

  def self.forbidden_flags
    FORBIDDEN_FLAGS.select { |flag| truthy?(ENV[flag]) }
  end

  def self.critical_secrets
    CRITICAL_SECRETS
  end

  def self.ensure_anchor_webhook!
    return unless truthy?(ENV['ANCHOR_API_KEY']) || ENV['ANCHOR_BASE_URL'].present?

    raise 'ANCHOR_WEBHOOK_SECRET must be set in production' if ENV['ANCHOR_WEBHOOK_SECRET'].to_s.strip.empty?
  end

  def self.ensure_bridge_cards_secrets!
    return unless truthy?(ENV['ENABLE_BRIDGE_CARDS'])

    missing = %w[BRIDGECARD_LIVE_TOKEN BRIDGECARD_LIVE_SECRET BRIDGECARD_LIVE_WEBHOOK_SECRET].reject do |key|
      ENV[key].to_s.strip.present?
    end
    raise "Missing Bridge card keys: #{missing.join(', ')}" if missing.any?
  end

  def self.ensure_monnify_credentials!
    missing = %w[MONNIFY_API_KEY MONNIFY_SECRET_KEY MONNIFY_CONTRACT_CODE MONNIFY_BASE_URL].reject do |key|
      ENV[key].to_s.strip.present?
    end
    raise "Missing Monnify credentials: #{missing.join(', ')}" if missing.any?
  end
end

ProductionSafety.ensure!
