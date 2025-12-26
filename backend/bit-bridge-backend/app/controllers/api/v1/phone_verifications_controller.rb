# frozen_string_literal: true

module Api
  module V1
    class PhoneVerificationsController < ApplicationController
      before_action :authenticate_user!

      # POST /api/v1/phone_verification/request
      def request_code
        profile = current_user.user_profile || current_user.build_user_profile

        phone_raw = params[:phone_number].presence || profile.phone_number
        if phone_raw.blank?
          render json: { errors: ["Phone number is required"] }, status: :unprocessable_entity and return
        end

        requested_e164 = PhoneNormalizer.to_e164_ng(phone_raw)
        if requested_e164.blank?
          render json: { errors: ["Invalid phone number format"] }, status: :unprocessable_entity and return
        end

        # Prevent sending OTP to a phone already tied to another user.
        if UserProfile.where.not(user_id: current_user.id)
                      .where(phone_number: phone_raw)
                      .exists?
          render json: {
            status: "phone_in_use",
            message: "Phone number is already in use."
          }, status: :unprocessable_entity and return
        end

        current_phone_raw = profile.phone_number
        current_phone_e164 =
          profile.phone_e164.presence ||
          (current_phone_raw.present? ? PhoneNormalizer.to_e164_ng(current_phone_raw) : nil)

        # 1) If user already has a VERIFIED phone and is requesting a DIFFERENT phone -> require password
        if profile.phone_verified_at.present? && current_phone_e164.present? && requested_e164 != current_phone_e164
          current_password = params[:current_password].to_s
          unless current_password.present? && current_user.valid_password?(current_password)
            render json: {
              status: "forbidden",
              message: "To change your verified phone number, please enter your current password."
            }, status: :forbidden and return
          end
        end

        # 2) If this user has VERIFIED this number before -> DO NOT send OTP again.
        if previously_verified_for_user?(requested_e164)
          upsert_verified_phone!(profile, phone_raw: phone_raw, phone_e164: requested_e164)

          render json: {
            status: "already_verified",
            message: "Phone number already verified.",
            phone_e164: requested_e164,
            phone_number: profile.phone_number,
            phone_verified_at: profile.phone_verified_at
          }, status: :ok and return
        end

        # 3) Rate limits / cooldown
        unless PhoneVerificationCode.allowed_to_send?(user_id: current_user.id, phone_e164: requested_e164)
          render json: {
            status: "rate_limited",
            message: "Too many verification requests. Please try again later."
          }, status: :too_many_requests and return
        end

        latest = PhoneVerificationCode.where(user: current_user, phone_e164: phone_variants(requested_e164)).recent.first

        if latest.present? && !latest.can_resend?
          wait = latest.resend_cooldown_seconds - (Time.current - latest.last_sent_at).to_i
          wait = [wait, 1].max

          render json: {
            status: "cooldown",
            message: "Please wait a moment before requesting another code.",
            resend_available_in_seconds: wait
          }, status: :too_many_requests and return
        end

        next_send_count = (latest&.send_count.to_i) + 1

        code = SecureRandom.random_number(1_000_000).to_s.rjust(6, "0")
        digest = BCrypt::Password.create(code)
        expires_at = Time.current + PhoneVerificationCode::TTL

        pvc = PhoneVerificationCode.create!(
          user: current_user,
          phone_e164: requested_e164,
          otp_digest: digest,
          expires_at: expires_at,
          status: "pending",
          last_sent_at: Time.current,
          send_count: next_send_count,
          attempts: 0,
          ip_address: request.remote_ip,
          user_agent: request.user_agent,
          provider: "termii"
        )

        # termii expects digits (no "+")
        result = TermiiClient.new.send_otp_sms!(to_e164: requested_e164, code: code)

        pvc.update!(
          provider_message_id: result[:message_id],
          provider_status: result[:provider_status],
          last_status_at: Time.current
        )

        # Some providers return non-success status but still deliver SMS.
        # If we have a message_id, treat as sent so UI can proceed.
        unless result[:ok] || result[:message_id].present?
          pvc.update!(status: "failed")
          render json: {
            status: "failed",
            reason: "sms_provider_unavailable",
            message: "Phone verification is temporarily unavailable. Please try again.",
            debug: { provider: "termii", http_status: result[:http_status] }
          }, status: :service_unavailable and return
        end

        # Store phone only if blank (smooth onboarding). Do NOT overwrite existing phone here.
        if profile.phone_number.blank?
          profile.phone_number = phone_raw
          profile.phone_e164 = requested_e164 if profile.respond_to?(:phone_e164=)
          profile.save! if profile.changed?
        end

        render json: {
          status: "sent",
          phone_e164: requested_e164,
          expires_at: expires_at,
          expires_in_seconds: PhoneVerificationCode::TTL.to_i,
          resend_available_in_seconds: pvc.resend_cooldown_seconds,
          provider_message_id: result[:message_id]
        }, status: :ok
      end

      # POST /api/v1/phone_verification/verify
      def verify_code
        profile = current_user.user_profile || current_user.build_user_profile

        code = params[:code].to_s.strip
        if code.blank?
          render json: { status: "invalid", errors: ["Code is required."] }, status: :unprocessable_entity and return
        end

        phone_raw = params[:phone_number].presence || profile.phone_number
        if phone_raw.blank?
          render json: { status: "invalid", errors: ["Phone number is required."] }, status: :unprocessable_entity and return
        end

        phone_e164 = PhoneNormalizer.to_e164_ng(phone_raw)
        if phone_e164.blank?
          render json: { status: "invalid", errors: ["Invalid phone number format."] }, status: :unprocessable_entity and return
        end

        pvc = PhoneVerificationCode.where(user: current_user, phone_e164: phone_variants(phone_e164)).order(created_at: :desc).first
        if pvc.nil?
          render json: { status: "not_found", errors: ["No verification request found. Please request a code again."] },
                 status: :not_found and return
        end

        if pvc.status == "blocked"
          render json: { status: "blocked", errors: ["Too many attempts. Please request a new code."] },
                 status: :too_many_requests and return
        end

        if pvc.expired?
          pvc.update!(status: "expired")
          render json: { status: "expired", errors: ["Code expired. Please request a new one."] },
                 status: :unprocessable_entity and return
        end

        pvc.update!(attempts: pvc.attempts.to_i + 1)
        if pvc.attempts >= PhoneVerificationCode::MAX_ATTEMPTS
          pvc.lock!
          render json: { status: "blocked", errors: ["Too many attempts. Please request a new code."] },
                 status: :too_many_requests and return
        end

        ok = BCrypt::Password.new(pvc.otp_digest) == code
        unless ok
          render json: { status: "invalid", errors: ["Invalid code. Please try again."] },
                 status: :unprocessable_entity and return
        end

        ActiveRecord::Base.transaction do
          pvc.update!(status: "verified")

          profile.phone_number = phone_raw
          profile.phone_e164 = phone_e164 if profile.respond_to?(:phone_e164=)
          profile.phone_verified_at = Time.current if profile.respond_to?(:phone_verified_at=)
          profile.save!

          PhoneVerificationCode
            .where(user: current_user, phone_e164: phone_variants(phone_e164), status: "pending")
            .where.not(id: pvc.id)
            .update_all(status: "expired")
        end

        render json: {
          status: "verified",
          phone_e164: phone_e164,
          phone_number: profile.phone_number,
          phone_verified_at: profile.phone_verified_at
        }, status: :ok
      end

      private

      # Handles legacy data where some rows may have "+234..." saved.
      def phone_variants(e164_digits)
        ["#{e164_digits}", "+#{e164_digits}"]
      end

      def previously_verified_for_user?(e164_digits)
        PhoneVerificationCode.exists?(user_id: current_user.id, phone_e164: phone_variants(e164_digits), status: "verified")
      end

      def upsert_verified_phone!(profile, phone_raw:, phone_e164:)
        profile.phone_number = phone_raw
        profile.phone_e164 = phone_e164 if profile.respond_to?(:phone_e164=)
        profile.phone_verified_at = Time.current if profile.respond_to?(:phone_verified_at=)
        profile.save! if profile.changed?
      end
    end
  end
end
