# frozen_string_literal: true

class RefreshSession < ApplicationRecord
  belongs_to :user

  validates :token_digest, presence: true, uniqueness: true
  validates :expires_at, presence: true

  scope :active, -> { where(revoked_at: nil).where('expires_at > ?', Time.current) }

  class << self
    def issue_for!(user:, ttl:, request: nil)
      raw = generate_raw_token
      create!(
        user: user,
        token_digest: digest_token(raw),
        expires_at: Time.current + ttl,
        last_used_at: Time.current,
        last_rotated_at: Time.current,
        user_agent: request_user_agent(request),
        ip_address: request_ip(request)
      )
      raw
    end

    def find_by_token(raw)
      return nil if raw.blank?

      find_by(token_digest: digest_token(raw))
    end

    def digest_token(raw)
      secret = ENV['AUTH_REFRESH_TOKEN_HMAC_SECRET'].presence || Rails.application.secret_key_base
      OpenSSL::HMAC.hexdigest('SHA256', secret, raw.to_s)
    end

    private

    def generate_raw_token
      SecureRandom.hex(32)
    end

    def request_user_agent(request)
      request&.user_agent.to_s.presence
    end

    def request_ip(request)
      request&.remote_ip.to_s.presence
    end
  end

  def expired?
    expires_at.present? && expires_at <= Time.current
  end

  def revoke!
    update!(revoked_at: Time.current)
  end

  def rotate!(ttl:, request: nil)
    raw = self.class.send(:generate_raw_token)
    update!(
      token_digest: self.class.digest_token(raw),
      expires_at: Time.current + ttl,
      revoked_at: nil,
      last_used_at: Time.current,
      last_rotated_at: Time.current,
      user_agent: request&.user_agent.to_s.presence || user_agent,
      ip_address: request&.remote_ip.to_s.presence || ip_address
    )
    raw
  end
end
