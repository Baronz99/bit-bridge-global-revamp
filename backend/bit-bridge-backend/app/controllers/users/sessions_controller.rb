# frozen_string_literal: true

module Users
  class SessionsController < Devise::SessionsController
    # login + refresh must be public
    skip_before_action :authenticate_user!, only: %i[create refresh]

    respond_to :json
    include RackSessionFix

    # DELETE /logout
    def destroy
      # Revoke refresh token on logout if user is present
      current_user&.revoke_refresh_token!
      # Let Devise clear warden session / JWT etc.
      super
    end

    # POST /refresh
    def refresh
      raw = request.headers['Bit-Refresh-Token'].presence
      return render json: { message: 'no refresh token' }, status: :unauthorized unless raw

      user = current_user || User.find_by(refresh_token: raw)
      return render json: { error: 'invalid_refresh' }, status: :unauthorized unless user

      # 1) Check expiry first
      if user.refresh_token_expired?
        user.revoke_refresh_token!
        return render json: {
          error: 'session_expired',
          message: 'Session expired. Please log in again.'
        }, status: :unauthorized
      end

      # 2) Then validate token value
      unless user.validate_refresh_token(raw)
        return render json: { error: 'invalid_refresh' }, status: :unauthorized
      end

      # 3) Rotate refresh token and issue new access token
      user.revoke_refresh_token!
      new_refresh_token = user.generate_refresh_token

      access_token, _payload =
        Warden::JWTAuth::UserEncoder.new.call(user, :user, nil)

      response.set_header('Bit-Refresh-Token', new_refresh_token)

      render json: {
        access_token: access_token,
        refresh_token: new_refresh_token
      }, status: :ok
    end

    private

    # Called on successful login
    # Called on successful login
def respond_with(resource, _opts = {})
  refresh_token = resource.generate_refresh_token
  resource.update!(
    refresh_token: refresh_token,
    refresh_token_expires_at: 30.minutes.from_now
  )

  # Get the JWT access token from the request environment
  access_token = request.env['warden-jwt_auth.token']

  response.set_header('Bit-Refresh-Token', refresh_token)

  render json: {
    status:  { code: 200, message: 'Logged in sucessfully.' },
    message: 'Logged in sucessfully.',
    data:    UserSerializer.new(resource).as_json,
    token: access_token  # ← Add this line!
  }, status: :ok
end

    # Called on logout
    def respond_to_on_destroy
      if current_user
        render json: { status: 200, message: 'logged out successfully' }, status: :ok
      else
        # Even if Devise doesn't see a current_user, still return 200
        render json: { status: 200, message: 'logged out (no active session)' }, status: :ok
      end
    end
  end
end
