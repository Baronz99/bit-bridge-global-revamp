# frozen_string_literal: true

class ApplicationController < ActionController::API
  include ActionController::Cookies
  before_action :force_json
  before_action :authenticate_user!
  before_action :configure_permitted_parameters, if: :devise_controller?

  protected

  # ✅ Prevent "Processing as HTML" when frontend misses Accept header
  def force_json
    request.format = :json unless params[:format]
  end

  def configure_permitted_parameters
    devise_parameter_sanitizer.permit(
      :sign_up,
      keys: [
        :role,
        { user_profile_attributes: %i[last_name first_name phone_number] }
      ]
    )
    devise_parameter_sanitizer.permit(:account_update, keys: %i[screen_name])
  end

  # =====================================================
  # ✅ Shared Transaction PIN gate (use everywhere money moves)
  #
  # IMPORTANT:
  # - Do NOT return 401 for PIN failures (frontend treats 401 as "session expired" and logs out).
  # - 401 should be reserved for invalid/expired auth token only.
  #
  # Status codes:
  # - 403: PIN not set
  # - 422: PIN missing/invalid
  # - 429: PIN locked out
  # =====================================================
  #
  # Usage:
  #   return unless require_transaction_pin!(params.dig(:account, :pin))
  #
  # Or (safe) just:
  #   return unless require_transaction_pin!
  #
  def require_transaction_pin!(raw_pin = nil, error_key: :message)
    unless current_user.respond_to?(:transaction_pin_set?) && current_user.transaction_pin_set?
      render json: { error_key => 'Please set a transaction PIN before performing this action.' },
             status: :forbidden
      return false
    end

    # ✅ Auto-extract PIN if nil/blank (prevents controllers passing nil and causing false 401s)
    pin = raw_pin.to_s.strip
    if pin.blank?
      pin =
        params[:pin].presence ||
        params[:transaction_pin].presence ||
        params.dig(:account, :pin).presence ||
        params.dig(:account, :transaction_pin).presence ||
        params.dig(:wallet, :transaction_pin).presence ||
        params.dig(:wallet, :pin).presence ||
        params.dig(:circle, :pin).presence ||
        params.dig(:circle, :transaction_pin).presence ||
        params.dig(:card, :transaction_pin).presence ||
        params.dig(:card, :pin).presence ||
        ''
      pin = pin.to_s.strip
    end

    if pin.blank?
      render json: { error_key => 'Transaction PIN is required' }, status: :unprocessable_entity
      return false
    end

    result = current_user.verify_transaction_pin_with_lockout(pin)

    if result == :locked
      secs = current_user.transaction_pin_lock_remaining_seconds
      render json: {
        error_key => "Too many failed attempts. Try again in #{(secs / 60.0).ceil} minute(s).",
        locked: true,
        retry_after_seconds: secs
      }, status: :too_many_requests
      return false
    end

    if result != true
      remaining = User::MAX_TRANSACTION_PIN_ATTEMPTS - (current_user.transaction_pin_attempts || 0)
      render json: {
        error_key => 'Invalid transaction PIN',
        attempts_remaining: [remaining, 0].max
      }, status: :unprocessable_entity   # ✅ 422 (NOT 401)
      return false
    end

    true
  end

  # Tier 1+ guard for restricted features (shared groups, tunnel, cards, transfers)
  def ensure_tier1!(message: nil)
    allowed_levels = %w[tier_1 tier_2]
    user_level = current_user&.kyc_level.to_s

    return if allowed_levels.include?(user_level)

    render json: {
      message: message || 'Complete Tier 1 verification to use this feature.'
    }, status: :forbidden
  end
end
