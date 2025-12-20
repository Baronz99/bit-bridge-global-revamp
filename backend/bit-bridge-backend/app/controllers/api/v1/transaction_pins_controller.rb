# frozen_string_literal: true

module Api
  module V1
    class TransactionPinsController < ApplicationController
      before_action :authenticate_user!

      # ✅ Allow /verify ONLY in development OR when explicitly enabled
      before_action :ensure_verify_enabled!, only: [:verify]

      # ✅ For production: require verified phone to SET/CHANGE PIN
      before_action :ensure_phone_verified!, only: [:set, :change]

      # POST /api/v1/transaction_pin/set
      # body: { pin: "1234" }  OR  { transaction_pin: "1234" }
      def set
        pin = extract_pin_param

        if pin.blank?
          return render json: { message: 'PIN is required' }, status: :unprocessable_entity
        end

        begin
          current_user.set_transaction_pin!(pin)
        rescue ArgumentError => e
          return render json: { message: e.message }, status: :unprocessable_entity
        rescue StandardError => e
          Rails.logger.error("Transaction PIN set failed: #{e.class} - #{e.message}")
          return render json: { message: 'Failed to set transaction PIN' }, status: :unprocessable_entity
        end

        render json: {
          message: 'Transaction PIN set successfully',
          pin_set: true,
          pin_set_at: current_user.transaction_pin_set_at
        }, status: :ok
      end

      # POST /api/v1/transaction_pin/verify (dev only unless enabled)
      # body: { pin: "1234" }
      def verify
        pin = extract_pin_param

        if pin.blank?
          return render json: { message: 'PIN is required' }, status: :unprocessable_entity
        end

        unless current_user.transaction_pin_set?
          return render json: { message: 'Transaction PIN not set' }, status: :unprocessable_entity
        end

        result = current_user.verify_transaction_pin_with_lockout(pin)

        if result == :locked
          secs = current_user.transaction_pin_lock_remaining_seconds
          return render json: {
            message: "Too many failed attempts. Try again in #{(secs / 60.0).ceil} minute(s).",
            locked: true,
            retry_after_seconds: secs
          }, status: :too_many_requests
        end

        if result == true
          return render json: { message: 'PIN verified', valid: true }, status: :ok
        end

        remaining = User::MAX_TRANSACTION_PIN_ATTEMPTS - (current_user.transaction_pin_attempts || 0)
        render json: {
          message: 'Invalid transaction PIN',
          valid: false,
          attempts_remaining: [remaining, 0].max
        }, status: :unauthorized
      end

      # PATCH /api/v1/transaction_pin/change
      # body: { current_pin: "1234", new_pin: "4321" }
      # OR:   { current_pin: "1234", pin: "4321" } (supports older clients)
      def change
        current_pin = params[:current_pin].to_s.strip
        new_pin = extract_new_pin_param

        if current_pin.blank?
          return render json: { message: 'Current PIN is required' }, status: :unprocessable_entity
        end

        if new_pin.blank?
          return render json: { message: 'New PIN is required' }, status: :unprocessable_entity
        end

        unless current_user.transaction_pin_set?
          return render json: { message: 'Transaction PIN not set' }, status: :unprocessable_entity
        end

        # ✅ verify old pin with lockout logic
        result = current_user.verify_transaction_pin_with_lockout(current_pin)

        if result == :locked
          secs = current_user.transaction_pin_lock_remaining_seconds
          return render json: {
            message: "Too many failed attempts. Try again in #{(secs / 60.0).ceil} minute(s).",
            locked: true,
            retry_after_seconds: secs
          }, status: :too_many_requests
        end

        unless result == true
          remaining = User::MAX_TRANSACTION_PIN_ATTEMPTS - (current_user.transaction_pin_attempts || 0)
          return render json: {
            message: 'Invalid current PIN',
            valid: false,
            attempts_remaining: [remaining, 0].max
          }, status: :unauthorized
        end

        begin
          current_user.set_transaction_pin!(new_pin)
        rescue ArgumentError => e
          return render json: { message: e.message }, status: :unprocessable_entity
        rescue StandardError => e
          Rails.logger.error("Transaction PIN change failed: #{e.class} - #{e.message}")
          return render json: { message: 'Failed to change transaction PIN' }, status: :unprocessable_entity
        end

        render json: {
          message: 'Transaction PIN changed successfully',
          pin_set: true,
          pin_set_at: current_user.transaction_pin_set_at
        }, status: :ok
      end

      # POST /api/v1/transaction_pin/reset/request
      # body: { phone_number: "+234..." } (optional; defaults to profile phone)
      #
      # ✅ Do NOT require phone_verified_at here.
      # OTP itself is the verification for "forgot PIN".
      def reset_request
        profile = current_user.user_profile || current_user.build_user_profile

        phone_raw = params[:phone_number].presence || profile.phone_number
        if phone_raw.blank?
          return render json: { errors: ['Phone number is required'] }, status: :unprocessable_entity
        end

        phone_e164 = PhoneNormalizer.to_e164_ng(phone_raw)

        # ---- Hard caps (cost guardrails) ----
        unless TransactionPinResetCode.allowed_to_send?(user_id: current_user.id, phone_e164: phone_e164)
          return render json: {
            status: 'rate_limited',
            message: 'Too many reset requests. Please try again later.'
          }, status: :too_many_requests
        end

        # Store phone on profile (keep consistent across platform)
        profile.phone_number = phone_raw
        profile.phone_e164 = phone_e164 if profile.respond_to?(:phone_e164=)
        profile.save! if profile.changed?

        reset = TransactionPinResetCode.find_or_initialize_by(user: current_user, phone_e164: phone_e164)

        # ---- Cooldown / backoff ----
        if reset.persisted? && !reset.can_resend?
          return render json: {
            status: 'cooldown',
            message: 'Please wait a moment before requesting another code.'
          }, status: :too_many_requests
        end

        code = SecureRandom.random_number(1_000_000).to_s.rjust(6, '0')
        digest = BCrypt::Password.create(code)

        reset.assign_attributes(
          otp_digest: digest,
          expires_at: Time.current + TransactionPinResetCode::TTL,
          status: 'pending',
          last_sent_at: Time.current,
          send_count: reset.send_count.to_i + 1,
          attempts: 0,

          ip_address: request.remote_ip,
          user_agent: request.user_agent,
          provider: 'termii'
        )
        reset.save!

        result = TermiiClient.new.send_otp_sms!(to_e164: phone_e164, code: code)

        reset.update!(
          provider_message_id: result[:message_id],
          provider_status: result[:provider_status],
          last_status_at: Time.current
        )

        unless result[:ok]
          reset.update!(status: 'failed')
          return render json: {
            status: 'failed',
            reason: 'sms_provider_unavailable',
            message: 'PIN reset is temporarily unavailable. Please try again.',
            debug: { provider: 'termii', http_status: result[:http_status] }
          }, status: :service_unavailable
        end

        render json: {
          status: 'sent',
          phone_e164: phone_e164,
          expires_in_seconds: TransactionPinResetCode::TTL.to_i,
          provider_message_id: result[:message_id]
        }, status: :ok
      end

      # POST /api/v1/transaction_pin/reset/confirm
      # body: { code: "123456", new_pin: "4321", phone_number: "+234..."? }
      def reset_confirm
        profile = current_user.user_profile

        code = params[:code].to_s.strip
        new_pin = extract_new_pin_param

        if code.blank?
          return render json: { status: 'invalid', errors: ['Code is required.'] }, status: :unprocessable_entity
        end

        if new_pin.blank?
          return render json: { status: 'invalid', errors: ['New PIN is required.'] }, status: :unprocessable_entity
        end

        phone_raw = params[:phone_number].presence || profile&.phone_number
        if phone_raw.blank?
          return render json: { status: 'invalid', errors: ['Phone number is required.'] }, status: :unprocessable_entity
        end

        phone_e164 = PhoneNormalizer.to_e164_ng(phone_raw)

        reset = TransactionPinResetCode
          .where(user: current_user, phone_e164: phone_e164)
          .order(created_at: :desc)
          .first

        if reset.nil?
          return render json: {
            status: 'not_found',
            errors: ['No reset request found. Please request a code again.']
          }, status: :not_found
        end

        if reset.status == 'blocked'
          return render json: {
            status: 'blocked',
            errors: ['Too many attempts. Please request a new code.']
          }, status: :too_many_requests
        end

        if reset.expired?
          reset.update!(status: 'expired')
          return render json: {
            status: 'expired',
            errors: ['Code expired. Please request a new one.']
          }, status: :unprocessable_entity
        end

        reset.update!(attempts: reset.attempts.to_i + 1)

        if reset.attempts >= TransactionPinResetCode::MAX_ATTEMPTS
          reset.lock!
          return render json: {
            status: 'blocked',
            errors: ['Too many attempts. Please request a new code.']
          }, status: :too_many_requests
        end

        ok = BCrypt::Password.new(reset.otp_digest) == code
        unless ok
          return render json: { status: 'invalid', errors: ['Invalid code. Please try again.'] },
                        status: :unprocessable_entity
        end

        begin
          current_user.set_transaction_pin!(new_pin)
        rescue ArgumentError => e
          return render json: { status: 'invalid', errors: [e.message] }, status: :unprocessable_entity
        rescue StandardError => e
          Rails.logger.error("Transaction PIN reset confirm failed: #{e.class} - #{e.message}")
          return render json: { status: 'failed', errors: ['Failed to reset transaction PIN'] },
                        status: :unprocessable_entity
        end

        reset.update!(status: 'verified')

        TransactionPinResetCode
          .where(user: current_user, phone_e164: phone_e164, status: 'pending')
          .where.not(id: reset.id)
          .update_all(status: 'expired')

        render json: {
          status: 'verified',
          message: 'Transaction PIN reset successfully',
          pin_set: true,
          pin_set_at: current_user.transaction_pin_set_at
        }, status: :ok
      end

      private

      # ✅ Require verified phone for set/change (but NOT for reset flow)
      def ensure_phone_verified!
        up = current_user.user_profile
        verified =
          current_user.phone_verified == true ||
          current_user.phone_verified_at.present? ||
          up&.phone_verified_at.present?

        return if verified

        render json: { message: 'Phone number must be verified before setting a transaction PIN' },
               status: :unprocessable_entity
      end

      def require_verified_phone!
  verified = current_user.user_profile&.phone_verified_at.present?
  return if verified

  render json: { message: "Verify your phone number to enable Transaction PIN." }, status: :forbidden
end


      # Supports multiple payload shapes so your frontend won’t break
      def extract_pin_param
        params[:pin].presence ||
          params[:transaction_pin].presence ||
          params.dig(:user, :pin).presence ||
          params.dig(:user, :transaction_pin).presence
      end

      # New pin can come from:
      # - { new_pin: "4321" }
      # - { pin: "4321" }
      # - { transaction_pin: "4321" }
      def extract_new_pin_param
        params[:new_pin].presence ||
          params[:pin].presence ||
          params[:transaction_pin].presence ||
          params.dig(:user, :new_pin).presence ||
          params.dig(:user, :pin).presence
      end

      # ✅ /verify should be dev-only unless explicitly enabled
      def ensure_verify_enabled!
        enabled = Rails.env.development? || ENV['ENABLE_TRANSACTION_PIN_VERIFY'] == 'true'
        return if enabled

        render json: { message: 'Not found' }, status: :not_found
      end
    end
  end
end
