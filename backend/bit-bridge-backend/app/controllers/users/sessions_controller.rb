# frozen_string_literal: true

module Users
  class SessionsController < Devise::SessionsController
    # login + refresh must be public
    skip_before_action :authenticate_user!, only: %i[create refresh]

    respond_to :json
    include RackSessionFix
    include ActionController::Cookies

    # DELETE /logout
    def destroy
      raw = refresh_token_from_request
      if current_user.present?
        raw.present? ? current_user.revoke_refresh_token!(raw) : current_user.revoke_all_refresh_tokens!
      end
      # Let Devise clear warden session / JWT etc.
      super
    end

    # POST /refresh
    def refresh
      raw = refresh_token_from_request
      return render json: { message: 'no refresh token' }, status: :unauthorized unless raw

      session = RefreshSession.find_by_token(raw)
      user = session&.user || User.find_by_refresh_token(raw, allow_legacy: legacy_refresh_lookup?)
      return render json: { error: 'invalid_refresh' }, status: :unauthorized unless user

      # 1) Check expiry first
      if session.present?
        if session.expired?
          session.revoke!
          return render json: {
            error: 'session_expired',
            message: 'Session expired. Please log in again.'
          }, status: :unauthorized
        end
      elsif user.refresh_token_expired?
        user.revoke_refresh_token!(raw)
        return render json: {
          error: 'session_expired',
          message: 'Session expired. Please log in again.'
        }, status: :unauthorized
      end

      # 2) Then validate token value
      unless session.present? || user.validate_refresh_token(raw)
        return render json: { error: 'invalid_refresh' }, status: :unauthorized
      end

      # 3) Rotate refresh token and issue new access token
      new_refresh_token =
        if session.present?
          session.rotate!(ttl: refresh_token_ttl, request: request)
        else
          user.revoke_refresh_token!(raw)
          user.generate_refresh_token(request: request)
        end

      access_token, _payload =
        Warden::JWTAuth::UserEncoder.new.call(user, :user, nil)

      set_refresh_cookie(new_refresh_token)
      response.set_header('Bit-Refresh-Token', new_refresh_token) if refresh_header_enabled?

      payload = { access_token: access_token }
      payload[:refresh_token] = new_refresh_token if refresh_body_enabled?

      render json: payload, status: :ok
    end

    private

    # Called on successful login
    def respond_with(resource, _opts = {})
      refresh_token = resource.generate_refresh_token(request: request)

      # Get the JWT access token from the request environment
      access_token = request.env['warden-jwt_auth.token']

      if resource.admin?
        resource.update_columns(
          admin_auth_time: Time.current,
          admin_role: resource.admin_role.presence || resource[:admin_role]
        )
      end

      set_refresh_cookie(refresh_token)
      response.set_header('Bit-Refresh-Token', refresh_token) if refresh_header_enabled?

      render json: {
        status:  { code: 200, message: 'Logged in sucessfully.' },
        message: 'Logged in sucessfully.',
        data:    UserSerializer.new(resource).as_json,
        token: access_token,
        refresh_token: (refresh_body_enabled? ? refresh_token : nil)
      }, status: :ok
    end

    # Called on logout
    def respond_to_on_destroy
      if current_user
        clear_refresh_cookie
        render json: { status: 200, message: 'logged out successfully' }, status: :ok
      else
        # Even if Devise doesn't see a current_user, still return 200
        clear_refresh_cookie
        render json: { status: 200, message: 'logged out (no active session)' }, status: :ok
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

    def legacy_refresh_lookup?
      ENV.fetch('AUTH_REFRESH_LEGACY_LOOKUP', 'true') == 'true'
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

    def refresh_token_from_request
      cookie_token =
        if refresh_cookie_enabled?
          cookies.encrypted[refresh_cookie_name].presence
        end

      header_token = request.headers['Bit-Refresh-Token'].presence

      return cookie_token if cookie_token.present?
      return header_token if refresh_header_enabled?

      nil
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

    def clear_refresh_cookie
      return unless refresh_cookie_enabled?

      options = {
        secure: refresh_cookie_secure?,
        same_site: refresh_cookie_same_site,
        path: '/'
      }
      domain = refresh_cookie_domain
      options[:domain] = domain if domain.present?

      cookies.delete(refresh_cookie_name, options)
    end
  end
end
