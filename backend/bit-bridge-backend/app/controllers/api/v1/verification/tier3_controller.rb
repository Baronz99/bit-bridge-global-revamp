# frozen_string_literal: true

module Api
  module V1
    module Verification
      class Tier3Controller < ApplicationController
        before_action :authenticate_user!

        # POST /api/v1/verification/tier3/start
        # Body: { image: "<base64 or data-url>" } OR { image_url: "<base64 or data-url>" }
        def start
          image     = params[:image].to_s.strip
          image_url = params[:image_url].to_s.strip

          # Accept either param name, but both should still be base64/data-url strings.
          input = image_url.presence || image.presence
          if input.blank?
            return render json: { error: "image or image_url is required" }, status: :unprocessable_entity
          end

          # Reject actual URLs (Prembly expects base64/data-url, and URLs cause confusion + failures)
          if input.match?(/\Ahttps?:\/\//i)
            return render json: { error: "image must be a base64 string or data URL (not a remote URL)" },
                          status: :unprocessable_entity
          end

          kyc = current_user.user_kyc
          return render json: { error: "KYC record not found" }, status: :unprocessable_entity if kyc.nil?

          unless kyc.verified?
            return render json: { error: "BVN must be verified before Tier 3" }, status: :unprocessable_entity
          end

          bvn = kyc.bvn_encrypted.to_s.gsub(/\D/, "")
          if bvn.length != 11
            return render json: { error: "Verified BVN not available. Please re-verify BVN." },
                          status: :unprocessable_entity
          end

          # Lock to prevent double-enqueue under rapid clicks
          kyc.with_lock do
            # Don’t enqueue repeatedly
            if %w[pending processing verified].include?(kyc.tier3_status.to_s)
              return render json: {
                status: kyc.tier3_status,
                message: "Tier 3 already #{kyc.tier3_status}"
              }, status: :ok
            end

            kyc.update!(
              tier3_status: "pending",
              tier3_error: nil,
              tier3_reference: nil,
              tier3_verified_at: nil
            )
          end

          Tier3VerificationJob.perform_later(current_user.id, input)

          render json: { message: "Tier 3 submitted", status: "pending" }, status: :ok
        rescue ActiveRecord::RecordInvalid => e
          render json: { error: e.record.errors.full_messages.join(", ") }, status: :unprocessable_entity
        rescue StandardError => e
          Rails.logger.error("[Tier3] start failed: #{e.class}: #{e.message}")
          render json: { error: "Tier 3 could not be started" }, status: :internal_server_error
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
