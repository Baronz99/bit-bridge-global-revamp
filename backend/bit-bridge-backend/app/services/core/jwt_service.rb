# frozen_string_literal: true

module Core
  require 'jwt'

  class JwtService
    ALGORITHM = 'HS256'

    def self.secret
      ENV['JWT_SECRET'].presence || Rails.application.secret_key_base
    end

    def self.encode(payload, exp: 24.hours.from_now)
      raise 'JWT secret missing' if secret.blank?

      data = payload.deep_dup
      data[:exp] = exp.to_i
      JWT.encode(data, secret, ALGORITHM)
    end

    def self.decode(token)
      raise 'JWT secret missing' if secret.blank?

      decoded, = JWT.decode(token, secret, true, { algorithm: ALGORITHM })
      decoded.with_indifferent_access
    end
  end

end
