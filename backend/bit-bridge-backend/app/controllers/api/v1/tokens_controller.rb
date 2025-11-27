# frozen_string_literal: true

# require 'set'

module Api
  module V1
    class TokensController < ApplicationController
      skip_before_action :authenticate_user!, only: [:token]

      # GET /bill_orders
      def token
        user = User.find_by(refresh_token: params[:refresh_token])

        if user&.refresh_token_expires_at && user.refresh_token_expires_at > Time.current
          token, = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil)
          new_refresh_token = SecureRandom.hex(32)

          response.set_header('Authorization', "Bearer #{token}")
          response.set_header('X-Refresh-Token', "Bearer #{new_refresh_token}")
          user.update!(refresh_token: new_refresh_token, refresh_token_expires_at: 30.minutes.from_now)

          render json: { access_token: token, refresh_toke: new_refresh_token }, status: :ok
        else
          render json: { error: 'Invalid refresh token' }, status: :unauthorized
        end
      end

      # Only allow a list of trusted parameters through.
      def bill_order_params
        params.require(:bill_order).permit(:status, :meter_number, :amount, :meter_type, :phone, :service_type,
                                           :payment_type, :email, :tariff_class, :description, :name)
      end
    end
  end
end
