# frozen_string_literal: true

module Api
  module V1
    class SessionsController < ActionController::API
      def create
        user = User.find_for_database_authentication(email: params[:email])

        if user&.valid_password?(params[:password])
          token = JwtService.encode(user_id: user.id)

          render json: {
            token: token,
            user: {
              id: user.id,
              email: user.email
            }
          }, status: :ok
        else
          render json: { error: "Invalid email or password" }, status: :unauthorized
        end
      end
    end
  end
end
