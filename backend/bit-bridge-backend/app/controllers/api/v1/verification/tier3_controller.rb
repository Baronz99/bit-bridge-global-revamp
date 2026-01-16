# frozen_string_literal: true

module Api
  module V1
    module Verification
      class Tier3Controller < ApplicationController
        before_action :authenticate_user!

        # POST /api/v1/verification/tier3/liveness
        # Body: { image: "<base64 or data-url>" }
        def liveness
          Rails.logger.warn("[Tier3] liveness image_len=#{params[:image].to_s.length}")

          image = params[:image].to_s.strip
          if image.blank?
            return render json: { error: "image is required" }, status: :unprocessable_entity
          end

          result = ::Kyc::PremblyTier3Biometrics.new.liveness_check(image)
          render json: result, status: :ok
        rescue StandardError => e
          Rails.logger.error("[Tier3] liveness failed: #{e.class}: #{e.message}")
          render json: { error: "Tier 3 liveness failed" }, status: :internal_server_error
        end

        # POST /api/v1/verification/tier3/start
        # Body: { image: "<base64 or data-url>" } OR { image_url: "<base64 or data-url>" }
        def start
          image     = params[:image].to_s.strip
          image_url = params[:image_url].to_s.strip

          # Accept either param name, but both should still be base64/data-url strings.
          input = image_url.presence || image.presence
          if input.blank?
            return render_with_requirements({ error: "image or image_url is required" }, :unprocessable_entity)
          end

          # Reject actual URLs (Prembly expects base64/data-url, and URLs cause confusion + failures)
          if input.match?(/\Ahttps?:\/\//i)
            return render_with_requirements(
              { error: "image must be a base64 string or data URL (not a remote URL)" },
              :unprocessable_entity
            )
          end

          kyc = current_user.user_kyc
          return render_with_requirements({ error: "KYC record not found" }, :unprocessable_entity) if kyc.nil?

          unless kyc.verified?
            return render_with_requirements({ error: "BVN must be verified before Tier 3" }, :unprocessable_entity)
          end

          unless kyc.bvn_identity_confirmed?
            return render_with_requirements(
              { error: "Verified BVN not available. Please re-verify BVN." },
              :unprocessable_entity
            )
          end

          raw_bvn = kyc.decrypted_bvn
          bvn = raw_bvn.to_s.gsub(/\D/, "")
          unless bvn.length == 11
            return render_with_requirements(
              { error: "Verified BVN not available. Please re-verify BVN." },
              :unprocessable_entity
            )
          end

          # Lock to prevent double-enqueue under rapid clicks
          kyc.with_lock do
            # Don’t enqueue repeatedly
            if %w[pending processing verified].include?(kyc.tier3_status.to_s)
              return render_with_requirements({
                status: kyc.tier3_status,
                message: "Tier 3 already #{kyc.tier3_status}"
              }, :ok)
            end

            kyc.update!(
              tier3_status: "pending",
              tier3_error: nil,
              tier3_reference: nil,
              tier3_verified_at: nil
            )
          end

          Tier3VerificationJob.perform_later(current_user.id, input)

          render_with_requirements({ message: "Tier 3 submitted", status: "pending" }, :ok)
        rescue ActiveRecord::RecordInvalid => e
          render_with_requirements({ error: e.record.errors.full_messages.join(", ") }, :unprocessable_entity)
        rescue StandardError => e
          Rails.logger.error("[Tier3] start failed: #{e.class}: #{e.message}")
          render_with_requirements({ error: "Tier 3 could not be started" }, :internal_server_error)
        end

        # GET /api/v1/verification/tier3/status
        def status
          kyc = current_user.user_kyc
          return render_with_requirements({ error: "KYC record not found" }, :unprocessable_entity) if kyc.nil?

          render_with_requirements(UserKycSerializer.new(kyc).as_json, :ok)
        end

        private

        def render_with_requirements(payload, status)
          payload[:requirements] = ::Kyc::RequirementsCalculator.new(current_user).call
          render json: payload, status: status
        end
      end
    end
  end
end
