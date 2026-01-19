# frozen_string_literal: true

require 'openssl'
require 'base64'

class BridgecardWebhookVerifier
  def initialize(body:, signature:, secrets:)
    @body = body.to_s
    @signature = signature.to_s
    @secrets = Array(secrets).compact.map(&:to_s).reject(&:empty?)
  end

  def valid?
    return false if @signature.empty? || @secrets.empty?

    signature_hex = normalize_signature(@signature)
    return false if signature_hex.nil?

    @secrets.any? do |secret|
      cmac_hex = compute_cmac_hex(secret, @body)
      cmac_hex && secure_compare(cmac_hex, signature_hex)
    end
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
end
