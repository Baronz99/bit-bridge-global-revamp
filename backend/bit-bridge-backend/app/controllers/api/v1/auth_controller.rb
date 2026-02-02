# frozen_string_literal: true

module Api
  module V1
    class AuthController < ApplicationController
      before_action :authenticate_user!

      MAX_PASSWORD_VERIFY_ATTEMPTS = 5
      PASSWORD_VERIFY_WINDOW = 5.minutes

      # POST /api/v1/auth/verify_password
      def verify_password
        if password.blank?
          return render json: { valid: false, message: 'Password is required' }, status: :unprocessable_entity
        end

        if throttle_limit_reached?
          return render json: {
            valid: false,
            message: 'Too many attempts. Try again in a few minutes.',
            retry_after_seconds: PASSWORD_VERIFY_WINDOW.to_i
          }, status: :too_many_requests
        end

        if current_user.valid_password?(password)
          reset_password_throttle
          render json: { valid: true }, status: :ok
        else
          increment_password_throttle
          render json: { valid: false, message: 'Invalid password' }, status: :unauthorized
        end
      end

      private

      def password
        params[:password].to_s
      end

      def password_throttle_key
        ip = request.remote_ip.presence || 'unknown'
        "auth_verify_password:#{current_user.id}:#{ip}"
      end

      def throttle_limit_reached?
        Rails.cache.read(password_throttle_key).to_i >= MAX_PASSWORD_VERIFY_ATTEMPTS
      end

      def increment_password_throttle
        attempts = Rails.cache.read(password_throttle_key).to_i
        Rails.cache.write(password_throttle_key, attempts + 1, expires_in: PASSWORD_VERIFY_WINDOW)
      end

      def reset_password_throttle
        Rails.cache.delete(password_throttle_key)
      end
    end
  end
end
