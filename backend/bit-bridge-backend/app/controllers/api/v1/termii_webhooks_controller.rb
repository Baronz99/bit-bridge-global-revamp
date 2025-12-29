# frozen_string_literal: true

module Api
  module V1
    class TermiiWebhooksController < ApplicationController
      # Termii will not be logged-in, so skip auth
      skip_before_action :authenticate_user!, raise: false

      # NOTE:
      # Do NOT use protect_from_forgery in API controllers (ActionController::API).
      # It causes boot crashes on Heroku.
      #
      # If your app is ActionController::Base (non-API), you can enable:
      # protect_from_forgery with: :null_session
      #
      # But since you're API-mode, we simply don't use CSRF here.

      # POST /api/v1/termii/dlr
      def dlr
        unless FeatureFlags.termii?
          raise StandardError, 'TERMII is disabled'
        end

        payload = request.request_parameters.presence || params.to_unsafe_h

        # ---- Optional: lightweight shared-secret auth (recommended for production) ----
        secret = ENV["TERMII_WEBHOOK_SECRET"].to_s
        if secret.present?
          incoming = request.headers["X-Webhook-Secret"].to_s

          # secure_compare requires same length; guard it
          unless incoming.present? &&
                 incoming.bytesize == secret.bytesize &&
                 ActiveSupport::SecurityUtils.secure_compare(incoming, secret)
            Rails.logger.warn("[TERMII DLR] Unauthorized webhook attempt")
            return render json: { message: "Unauthorized" }, status: :unauthorized
          end
        end

        message_id = extract_message_id(payload)
        raw_status = extract_status(payload)

        if message_id.blank?
          Rails.logger.warn("[TERMII DLR] Missing message_id. payload=#{payload.inspect}")
          return render json: { ok: true }, status: :ok
        end

        pvc = PhoneVerificationCode.find_by(provider_message_id: message_id)

        unless pvc
          Rails.logger.warn("[TERMII DLR] No matching PhoneVerificationCode for message_id=#{message_id}")
          return render json: { ok: true }, status: :ok
        end

        normalized = normalize_status(raw_status.presence || pvc.provider_status)

        pvc.update!(
          provider: "termii",
          provider_status: normalized,
          last_status_at: Time.current
        )

        # NOTE: Delivery does NOT mean verification.
        # Keep pvc.status as pending/verified/expired/blocked based on your OTP flow.

        render json: { ok: true }, status: :ok
      rescue StandardError => e
        Rails.logger.error("[TERMII DLR] Error: #{e.class} - #{e.message}")
        render json: { ok: true }, status: :ok
      end

      private

      def extract_message_id(payload)
        payload["message_id"] ||
          payload["messageId"] ||
          payload["sms_id"] ||
          payload.dig("data", "message_id") ||
          payload.dig("data", "messageId") ||
          payload.dig("data", "sms_id") ||
          payload.dig("data", "id")
      end

      def extract_status(payload)
        payload["status"] ||
          payload["delivery_status"] ||
          payload["deliveryStatus"] ||
          payload.dig("data", "status") ||
          payload.dig("data", "delivery_status") ||
          payload.dig("data", "deliveryStatus")
      end

      def normalize_status(raw)
        s = raw.to_s.downcase.strip
        return "unknown" if s.blank?

        return "delivered" if %w[delivered success successful].include?(s)
        return "failed"    if %w[failed undelivered rejected].include?(s)
        return "pending"   if %w[pending queued sent].include?(s)

        s
      end
    end
  end
end
