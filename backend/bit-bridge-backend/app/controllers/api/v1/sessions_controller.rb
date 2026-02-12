# frozen_string_literal: true

module Api
  module V1
    class SessionsController < ApplicationController
      skip_before_action :authenticate_user!, only: [:create]

      # POST /api/v1/login
      def create
        email = params.dig(:user, :email) || params[:email]
        password = params.dig(:user, :password) || params[:password]

        if email.blank? || password.blank?
          return render json: { error: 'Email and password are required' }, status: :unprocessable_entity
        end

        user = User.find_for_database_authentication(email: email)

        unless user&.valid_password?(password)
          return render json: { error: 'Invalid email or password' }, status: :unauthorized
        end

        unless user.confirmed?
          return render json: {
            error: 'email_not_confirmed',
            message: 'Please confirm your email before logging in.'
          }, status: :forbidden
        end

        # ✅ Generate a Devise-JWT compatible token
        access_token, _payload = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil)
        refresh_token = user.generate_refresh_token

        if user.admin?
          user.update_columns(
            admin_auth_time: Time.current,
            admin_role: user.admin_role.presence || user[:admin_role]
          )
        end
        serialized_user = UserSerializer.new(user).as_json

        render json: {
          status: { code: 200, message: 'Logged in successfully.' },
          token: access_token,
          access_token: access_token,
          refresh_token: refresh_token,
          user: serialized_user
        }, status: :ok
      rescue StandardError => e
        Rails.logger.error("[API LOGIN] #{e.class}: #{e.message}")
        Rails.logger.error(e.backtrace.first(10).join("\n")) if e.backtrace
        render json: { error: 'Internal Server Error' }, status: :internal_server_error
      end
    end
  end
end
