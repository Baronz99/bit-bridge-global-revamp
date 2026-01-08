# frozen_string_literal: true

module Api
  module V1
    module Verification
      class Tier3Controller < ApplicationController
        # If your API uses auth, keep this. If your app uses a different method,
        # replace with your existing authentication hook.
        before_action :authenticate_user!

        # POST /api/v1/verification/tier3/start
        # Body: { image: "<base64>", bvn?: "12345678901" }
        def start
          image = params[:image].to_s
          bvn   = params[:bvn].to_s.presence

          if image.blank?
            return render json: { error: "image is required" }, status: :unprocessable_entity
          end

          # Optional basic BVN validation (only if provided)
          if bvn.present? && bvn.gsub(/\D/, "").length != 11
            return render json: { error: "bvn must be 11 digits" }, status: :unprocessable_entity
          end

          # TODO: Plug in your real tier3 flow:
          # - run liveness
          # - run BVN face match
          # - store a verification reference + status
          # - upgrade user kyc_level to tier_3 on success

          render json: {
            message: "Tier 3 verification received",
            status: "submitted"
          }, status: :ok
        rescue => e
          render json: { error: e.message }, status: :internal_server_error
        end
      end
    end
  end
end
