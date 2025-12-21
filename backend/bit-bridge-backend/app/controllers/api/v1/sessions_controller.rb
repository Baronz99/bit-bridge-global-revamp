# frozen_string_literal: true

module Api
  module V1
    class SessionsController < ActionController::API
      # POST /api/v1/login
      def create
        email = params.dig(:user, :email) || params[:email]
        password = params.dig(:user, :password) || params[:password]

        if email.blank? || password.blank?
          return render json: { error: "Email and password are required" }, status: :unprocessable_entity
        end

        user = User.find_for_database_authentication(email: email)

        unless user&.valid_password?(password)
          return render json: { error: "Invalid email or password" }, status: :unauthorized
        end

        token = JwtService.encode(user_id: user.id)

        render json: {
          token: token,
          user: {
            id: user.id,
            email: user.email
          }
        }, status: :ok
      rescue StandardError => e
        Rails.logger.error("[API LOGIN] #{e.class}: #{e.message}")
        Rails.logger.error(e.backtrace.first(10).join("\n")) if e.backtrace
        render json: { error: "Internal Server Error" }, status: :internal_server_error
      end
    end
  end
end
