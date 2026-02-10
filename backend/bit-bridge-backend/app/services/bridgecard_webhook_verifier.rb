# frozen_string_literal: true

require 'openssl'
require 'base64'
require 'digest'

class BridgecardWebhookVerifier
  def initialize(body:, signature:, secrets:)
    @body = body.to_s
    @signature = signature.to_s
    @secrets = Array(secrets).compact.map(&:to_s).reject(&:empty?)
  end

  def valid?
    if @signature.empty? || @secrets.empty?
      log_diagnostics(stage: 'precheck_failed', normalized_signature: nil, attempted: [])
      return false
    end

    signature_hex = normalize_signature(@signature)
    if signature_hex.nil?
      log_diagnostics(stage: 'signature_normalize_failed', normalized_signature: nil, attempted: [])
      return false
    end

    attempted = []
    matched = @secrets.any? do |secret|
      cmac_hex = compute_cmac_hex(secret, @body)
      attempted << {
        secret_len: secret.length,
        secret_hex: hex_string?(secret.strip),
        cmac_present: cmac_hex.present?,
        cmac_len: cmac_hex.to_s.length
      }
      cmac_hex && secure_compare(cmac_hex, signature_hex)
    end

    log_diagnostics(stage: 'compare_failed', normalized_signature: signature_hex, attempted: attempted) unless matched
    matched
  end

  private

  def compute_cmac_hex(secret, body)
    key = decode_key(secret)
    if defined?(OpenSSL::CMAC)
      cmac = OpenSSL::CMAC.new('AES', key)
      cmac.update(body)
      cmac.hexdigest
    elsif Rails.env.test?
      OpenSSL::HMAC.hexdigest('SHA256', key, body)
    else
      nil
    end
  end

  def decode_key(secret)
    trimmed = secret.strip
    if hex_string?(trimmed)
      [trimmed].pack('H*')
    else
      trimmed
    end
  end

  def normalize_signature(signature)
    trimmed = signature.strip
    return nil if trimmed.empty?
    return trimmed.downcase if hex_string?(trimmed)

    Base64.decode64(trimmed).unpack1('H*')
  rescue ArgumentError, TypeError
    nil
  end

  def hex_string?(value)
    value.match?(/\A[0-9a-fA-F]+\z/) && value.length.even?
  end

  def secure_compare(a, b)
    return false if a.blank? || b.blank?
    return false unless a.bytesize == b.bytesize

    ActiveSupport::SecurityUtils.secure_compare(a, b)
  end

  def log_diagnostics(stage:, normalized_signature:, attempted:)
    return unless debug_enabled?
    return unless defined?(Rails) && Rails.logger

    Rails.logger.warn(
      "[BridgecardWebhookVerifier] stage=#{stage} " \
      "signature_len=#{@signature.length} signature_hex=#{hex_string?(@signature.strip)} " \
      "signature_base64_like=#{base64_like?(@signature.strip)} normalized_len=#{normalized_signature.to_s.length} " \
      "body_len=#{@body.bytesize} body_sha256=#{Digest::SHA256.hexdigest(@body)[0, 16]} " \
      "secrets_count=#{@secrets.size} attempts=#{attempted.inspect}"
    )
  rescue StandardError => e
    Rails.logger.warn("[BridgecardWebhookVerifier] diagnostics_log_failed message=#{e.message}") if defined?(Rails) && Rails.logger
  end

  def base64_like?(value)
    return false if value.blank?

    value.match?(/\A[A-Za-z0-9+\/=]+\z/)
  end

  def debug_enabled?
    flag = ENV['BRIDGECARD_WEBHOOK_DIAGNOSTICS'].to_s.strip.downcase
    %w[1 true yes on].include?(flag)
  end
end
