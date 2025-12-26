# frozen_string_literal: true

# require 'set'

module Api
  module V1
    class TokensController < ApplicationController
      skip_before_action :authenticate_user!, only: [:token]

      # GET /bill_orders
      def token
        raw = params[:refresh_token]
        user = User.find_by_refresh_token(raw, allow_legacy: legacy_refresh_lookup?)

        if user&.refresh_token_expires_at && user.refresh_token_expires_at > Time.current
          token, = Warden::JWTAuth::UserEncoder.new.call(user, :user, nil)
          new_refresh_token = user.generate_refresh_token

          response.set_header('Authorization', "Bearer #{token}")
          response.set_header('X-Refresh-Token', "Bearer #{new_refresh_token}")

          render json: { access_token: token, refresh_toke: new_refresh_token, refresh_token: new_refresh_token }, status: :ok
        else
          render json: { error: 'Invalid refresh token' }, status: :unauthorized
        end
      end

      def legacy_refresh_lookup?
        ENV.fetch('AUTH_REFRESH_LEGACY_LOOKUP', 'true') == 'true'
      end

      # Only allow a list of trusted parameters through.
      def bill_order_params
        params.require(:bill_order).permit(:status, :meter_number, :amount, :meter_type, :phone, :service_type,
                                           :payment_type, :email, :tariff_class, :description, :name)
      end
    end
  end
end
