# frozen_string_literal: true

module Api
  module V1
    module Verification
      class Tier3Controller < ApplicationController
        before_action :authenticate_user!

        # POST /api/v1/verification/tier3/start
        # Body: { image: "<base64>" } OR { tier3: { image: "<base64>" } }
        def start
          image =
            params[:image].presence ||
            params.dig(:tier3, :image).presence

          image = image.to_s

          if image.blank?
            return render json: { error: "image is required" }, status: :unprocessable_entity
          end

          kyc = current_user.user_kyc
          if kyc.nil?
            return render json: { error: "KYC record not found" }, status: :unprocessable_entity
          end

          unless kyc.verified?
            return render json: { error: "BVN must be verified before Tier 3" }, status: :unprocessable_entity
          end

          bvn = kyc.bvn_encrypted.to_s.gsub(/\D/, "")
          if bvn.length != 11
            return render json: { error: "Verified BVN not available. Please re-verify BVN." }, status: :unprocessable_entity
          end

          if %w[pending processing].include?(kyc.tier3_status.to_s)
            return render json: { status: kyc.tier3_status, message: "Tier 3 already in progress" }, status: :ok
          end

          kyc.update!(
            tier3_status: "pending",
            tier3_error: nil,
            tier3_reference: nil,
            tier3_verified_at: nil
          )

          Tier3VerificationJob.perform_later(current_user.id, image)

          render json: { message: "Tier 3 submitted", status: kyc.tier3_status }, status: :ok
        rescue StandardError => e
          render json: { error: e.message }, status: :internal_server_error
        end

        # GET /api/v1/verification/tier3/status
        def status
          kyc = current_user.user_kyc
          return render json: { error: "KYC record not found" }, status: :unprocessable_entity if kyc.nil?

          render json: UserKycSerializer.new(kyc).as_json, status: :ok
        end
      end
    end
  end
end
