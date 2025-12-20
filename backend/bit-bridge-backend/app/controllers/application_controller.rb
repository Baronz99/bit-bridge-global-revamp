# frozen_string_literal: true

class ApplicationController < ActionController::API
  before_action :authenticate_user!
  before_action :configure_permitted_parameters, if: :devise_controller?

  protected

  def configure_permitted_parameters
    devise_parameter_sanitizer.permit(:sign_up, keys: [
      :role,
      { user_profile_attributes: %i[last_name first_name phone_number] }
    ])
    devise_parameter_sanitizer.permit(:account_update, keys: %i[screen_name])
  end

  # =====================================================
  # ✅ Shared Transaction PIN gate (use everywhere money moves)
  # =====================================================
  def require_transaction_pin!(raw_pin)
    unless current_user.transaction_pin_set?
      render json: { message: 'Please set a transaction PIN before performing this action.' },
             status: :unprocessable_entity
      return false
    end

    result = current_user.verify_transaction_pin_with_lockout(raw_pin)

    if result == :locked
      secs = current_user.transaction_pin_lock_remaining_seconds
      render json: {
        message: "Too many failed attempts. Try again in #{(secs / 60.0).ceil} minute(s).",
        locked: true,
        retry_after_seconds: secs
      }, status: :too_many_requests
      return false
    end

    if result != true
      remaining = User::MAX_TRANSACTION_PIN_ATTEMPTS - (current_user.transaction_pin_attempts || 0)
      render json: {
        message: 'Invalid transaction PIN',
        attempts_remaining: [remaining, 0].max
      }, status: :unauthorized
      return false
    end

    true
  end
end
