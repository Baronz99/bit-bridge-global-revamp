# frozen_string_literal: true

class ApplicationController < ActionController::API
  include ActionController::Cookies

  before_action :log_debug_request, if: :debug_request_logging_enabled?
  before_action :force_json
  before_action :authenticate_user!, unless: :devise_controller?
  before_action :configure_permitted_parameters, if: :devise_controller?

  rescue_from ActionDispatch::Http::Parameters::ParseError, with: :handle_parse_error

  protected

  # ✅ Prevent "Processing as HTML" when frontend misses Accept header
  def force_json
    request.format = :json
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
      render_pin_error(
        "Please set a transaction PIN before performing this action.",
        :forbidden,
        error_key,
        error_code: 'transaction_pin_not_set'
      )
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
        ""
      pin = pin.to_s.strip
    end

    if pin.blank?
      render_pin_error(
        "Transaction PIN is required",
        :unprocessable_entity,
        error_key,
        error_code: 'transaction_pin_required'
      )
      return false
    end

    result = current_user.verify_transaction_pin_with_lockout(pin)

    if result == :locked
      secs = current_user.transaction_pin_lock_remaining_seconds
      payload = {
        error_key => "Too many failed attempts. Try again in #{(secs / 60.0).ceil} minute(s).",
        error_code: 'transaction_pin_locked',
        locked: true,
        retry_after_seconds: secs
      }
      payload = { errors: [payload[error_key]] }.merge(payload.except(error_key)) if error_key == :errors
      render json: payload, status: :too_many_requests
      return false
    end

    if result != true
      remaining = User::MAX_TRANSACTION_PIN_ATTEMPTS - (current_user.transaction_pin_attempts || 0)
      payload = {
        error_key => "Invalid transaction PIN",
        error_code: 'transaction_pin_invalid',
        attempts_remaining: [remaining, 0].max
      }
      payload = { errors: [payload[error_key]] }.merge(payload.except(error_key)) if error_key == :errors
      render json: payload, status: :unprocessable_entity
      return false
    end

    true
  end

  def render_pin_error(message, status, error_key, error_code: nil)
    if error_key == :errors
      payload = { errors: [message] }
      payload[:error_code] = error_code if error_code.present?
      render json: payload, status: status
    else
      payload = { error_key => message }
      payload[:error_code] = error_code if error_code.present?
      render json: payload, status: status
    end
  end

  # Tier 2 guard for restricted features (shared groups, tunnel, cards, transfers)
  def ensure_tier2!(message: nil)
    required_level = 'tier_2'

    return if current_user&.kyc_at_least?(required_level)

    render json: {
      error: 'kyc_required',
      required_level: required_level,
      message: message || "Complete Tier 2 verification to use this feature."
    }, status: :forbidden
  end

  def ensure_super_admin!
    return if current_user&.super_admin?

    render json: { message: 'Not authorized' }, status: :forbidden
  end

  private

  def debug_request_logging_enabled?
    return true if ENV['DEBUG_REQUESTS'].to_s == '1'

    path = request.path.to_s
    return true if path == '/api/v1/payment_processors/process_payment'
    return true if path == '/api/v1/payment_processors/get_price_list'
    return true if path == '/api/v1/provisions'

    false
  end

  def log_debug_request(parse_success: nil, error: nil)
    return unless debug_request_logging_enabled?

    raw = read_raw_body
    truncated = raw.to_s.byteslice(0, 2048) || ''
    redacted = redact_raw_body(truncated)

    json_parse_succeeded = parse_success
    if json_parse_succeeded.nil?
      if request.content_type.to_s.include?('json') && raw.to_s.strip != ''
        begin
          JSON.parse(raw.to_s)
          json_parse_succeeded = true
        rescue StandardError
          json_parse_succeeded = false
        end
      end
    end

    payload = {
      request_id: request.request_id,
      method: request.method,
      path: request.path,
      query_string: request.query_string,
      content_type: request.content_type,
      accept: request.headers['Accept'],
      user_agent: request.user_agent,
      content_length: request.content_length,
      json_parse_succeeded: json_parse_succeeded,
      raw_body: redacted,
      error_class: error&.class&.name,
      error_message: error&.message
    }.compact

    Rails.logger.info("[REQUEST_DEBUG] #{payload.to_json}")
  rescue StandardError => e
    Rails.logger.warn("[REQUEST_DEBUG] log_failed error=#{e.class} message=#{e.message}")
  end

  def handle_parse_error(error)
    log_debug_request(parse_success: false, error: error)
    render json: {
      status: 400,
      error: 'Bad Request',
      message: 'Invalid JSON payload',
      request_id: request.request_id
    }, status: :bad_request
  end

  def read_raw_body
    return '' unless request.body

    raw = request.body.read
    request.body.rewind
    raw
  end

  def redact_raw_body(raw)
    data = raw.to_s
    data = data.gsub(/Bearer\s+[A-Za-z0-9\-_\.=]+/i, 'Bearer [REDACTED]')
    data = data.gsub(/\beyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+\b/, '[REDACTED_JWT]')
    data = data.gsub(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, '[REDACTED_EMAIL]')
    data = data.gsub(
      /(\"?(billersCode|phone|meter_number|meterNumber)\"?\s*[:=]\s*\")([^\"]+)(\")/i,
      '\1[REDACTED]\4'
    )
    data = data.gsub(/(\"?email\"?\s*[:=]\s*\")([^\"]+)(\")/i, '\1[REDACTED]\3')
    data
  end
end
