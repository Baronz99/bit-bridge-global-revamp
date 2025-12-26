# frozen_string_literal: true

# app/controllers/users/confirmations_controller.rb
module Users
  class ConfirmationsController < Devise::ConfirmationsController
    include ActionController::Cookies
    # Confirmation must be public; user isn't logged in yet
    skip_before_action :authenticate_user!, only: [:show]

    # GET /confirmation?confirmation_token=abcdef
    def show
      self.resource = resource_class.confirm_by_token(params[:confirmation_token])

      if resource.errors.empty?
        user = resource

        # generate / rotate refresh token
        new_refresh_token = user.generate_refresh_token

        # issue access token
        access_token, _payload =
          Warden::JWTAuth::UserEncoder.new.call(user, :user, nil)

        # expose refresh token same way as login/refresh
        set_refresh_cookie(new_refresh_token)
        response.set_header('Bit-Refresh-Token', new_refresh_token) if refresh_header_enabled?

        puts '✅ successful confirmation — returning tokens to frontend'

        payload = { message: 'User confirmed', access_token: access_token }
        payload[:refresh_token] = new_refresh_token if refresh_body_enabled?
        render json: payload, status: :ok
      else
        render json: {
          message: 'Failed to confirm',
          errors:  resource.errors.full_messages
        }, status: :unprocessable_entity
      end
    end

    def refresh_cookie_enabled?
      ENV.fetch('AUTH_REFRESH_COOKIE_ENABLED', 'false') == 'true'
    end

    def refresh_header_enabled?
      ENV.fetch('AUTH_REFRESH_HEADER_ENABLED', 'true') == 'true'
    end

    def refresh_body_enabled?
      ENV.fetch('AUTH_REFRESH_BODY_ENABLED', 'true') == 'true'
    end

    def refresh_token_ttl
      ENV.fetch('AUTH_REFRESH_TOKEN_TTL_SECONDS', 30.days.to_i).to_i
    end

    def refresh_cookie_name
      ENV.fetch('AUTH_REFRESH_COOKIE_NAME', 'bb_refresh')
    end

    def refresh_cookie_same_site
      ENV.fetch('AUTH_REFRESH_COOKIE_SAMESITE', 'lax').to_sym
    end

    def refresh_cookie_secure?
      if ENV.key?('AUTH_REFRESH_COOKIE_SECURE')
        ENV.fetch('AUTH_REFRESH_COOKIE_SECURE', 'false') == 'true'
      else
        Rails.env.production?
      end
    end

    def refresh_cookie_domain
      ENV['AUTH_REFRESH_COOKIE_DOMAIN'].presence
    end

    def set_refresh_cookie(token)
      return unless refresh_cookie_enabled?

      options = {
        value: token,
        httponly: true,
        secure: refresh_cookie_secure?,
        same_site: refresh_cookie_same_site,
        path: '/',
        expires: Time.current + refresh_token_ttl
      }

      domain = refresh_cookie_domain
      options[:domain] = domain if domain.present?

      cookies.encrypted[refresh_cookie_name] = options
    end
  end
end
