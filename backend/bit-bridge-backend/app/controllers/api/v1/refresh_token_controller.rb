# frozen_string_literal: true

module Api
  module V1
    class RefreshTokenController < ApplicationController
      #   before_action :set_wallet, only: %i[ show update destroy ]

      # GET /wallets
      def refresh
        # current_user = User.find_by(id: params[:user_id])

        User.find_by(id: params[:user_id])&.refresh_token!



        render json: @wallets
      end

      # Only allow a list of trusted parameters through.
      def wallet_params
        params.require(:wallet).permit(:user_id)
      end
    end
  end
end
