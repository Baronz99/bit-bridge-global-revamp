# frozen_string_literal: true

require 'uri'
class BuyPowerPaymentService
  include HTTParty

  # Required env vars:
  # - BUYPOWER_TOKEN
  # - BUYPOWER_BASE_URL
  # - BILLS_CONFIRMATION_MODE (optional)
  PROVIDER_OPEN_TIMEOUT = 5
  PROVIDER_READ_TIMEOUT = 15
  default_options.update(timeout: PROVIDER_READ_TIMEOUT, open_timeout: PROVIDER_OPEN_TIMEOUT)

  def initialize
    Config::Bills.validate!
    self.class.base_uri(Config::Bills.base_url)

    token = Config::Bills.token
    @get_headers  = { 'Authorization' => "Bearer #{token}" }
    @post_headers = { 'Authorization' => "Bearer #{token}" }
  end


  def process_payment(current_user, payment_processor_params)
    res = nil

    service_type = payment_processor_params[:service_type].to_s
    service_type_upcase = service_type.strip.upcase
    is_electricity = service_type_upcase == 'ELECTRICITY'
    res = verify_meter(payment_processor_params) if is_electricity && payment_processor_params[:skip] != true

    resolved_meter_type =
      if is_electricity
        res&.dig('vendType') || payment_processor_params[:meter_type] || 'PREPAID'
      elsif service_type_upcase == 'TV'
        payment_processor_params[:vend_type] || payment_processor_params[:meter_type] || 'PREPAID'
      else
        nil
      end

    bill_order = current_user&.bill_orders&.new(
      meter_number: payment_processor_params[:billersCode],
      meter_type: resolved_meter_type,
      address: res&.dig('address') || payment_processor_params[:billersCode],
      name: res&.dig('name') || payment_processor_params[:billersCode],
      tariff_class: payment_processor_params[:tariff_class],
      service_type: service_type,
      email: current_user.email || payment_processor_params[:email],
      amount: payment_processor_params[:amount],
      phone: current_user.user_profile&.phone_number || payment_processor_params[:phone],
      biller: payment_processor_params[:biller],
      description: payment_processor_params[:description],
      demand_category: res&.dig('demandCategory')
    ) || BillOrder.new(
      meter_number: payment_processor_params[:billersCode],
      meter_type: resolved_meter_type,
      address: res&.dig('address') || payment_processor_params[:billersCode],
      name: res&.dig('name') || payment_processor_params[:billersCode],
      tariff_class: payment_processor_params[:tariff_class],
      service_type: service_type,
      email: payment_processor_params[:email],
      amount: payment_processor_params[:amount],
      phone: payment_processor_params[:phone],
      biller: payment_processor_params[:biller],
      description: payment_processor_params[:description],
      demand_category: res&.dig('demandCategory')
    )




    raise bill_order.errors.full_messages.to_sentence unless bill_order.save

    { response: bill_order, status: 'success' }
  rescue StandardError => e
    { response: e.message.to_s, status: 'error' }
  end

  def verify_meter(verify_processor_params)
    meter_number = verify_processor_params[:billersCode]
    biller = verify_processor_params[:biller]
    meter_type = verify_processor_params[:meter_type]
    service_type = verify_processor_params[:service_type].upcase



    begin
      response = self.class.get(
        "/check/meter?meter=#{meter_number}&disco=#{biller}&vendType=#{meter_type}&vertical=#{service_type}&orderId=false", headers: @get_headers
      )


      raise response['message'] unless response.success?




      response
    rescue StandardError => e
      raise e.message
    end
  end

  def verify_tv_account(params)
    billers_code = params[:billersCode] || params[:smartcard] || params[:decoder] || params[:account_number]
    biller = params[:biller] || params[:provider]
    service_type = params[:service_type].to_s.strip.upcase
    service_type = 'TV' if service_type.blank?
    raw_vend_type = params[:vend_type] || params[:meter_type]
    vend_type = raw_vend_type.to_s.strip.upcase
    vend_type = 'PREPAID' unless %w[PREPAID POSTPAID RECOVERY].include?(vend_type)

    response = self.class.get(
      "/check/meter?meter=#{billers_code}&disco=#{biller}&vendType=#{vend_type}&vertical=#{service_type}&orderId=false",
      headers: @get_headers
    )

    raise response['message'] unless response.success?

    { response: response, status: 'success' }
  rescue StandardError => e
    { response: e.message.to_s, status: 'error' }
  end

  def pay_data(electric_bill_order)
    body = build_vend_body(
      electric_bill_order,
      phone: electric_bill_order['meter_number']
    )


    begin
      response = self.class.post('/vend', headers: @post_headers, body: body)

      raise response['message'] unless response.success?

      electric_bill_order.update(status: 'completed', units: response['data']['units'],
                                 token: response['data']['token'], transaction_id: response['data']['id'])
      { response: electric_bill_order, status: 'success' }
    rescue StandardError => e
      { response: e.message.to_s, status: 'error' }
    end
  end

  def confirm_subscription(electric_bill_order, payment_method = 'wallet', use_commission = false, request_id: nil, idempotency_key: nil)
    body = build_vend_body(
      electric_bill_order,
      phone:
        electric_bill_order['phone'] ||
        (electric_bill_order['service_type'] == 'TV' ? '07064334160' : electric_bill_order['meter_number'])
    )

    user = electric_bill_order.user
    raise 'No user associated with this order' unless user

    request_tag = "request_id=#{request_id || 'unknown'} bill_order_id=#{electric_bill_order&.id || electric_bill_order&.dig('id')}"
    Rails.logger.info("BuyPower confirm_subscription start #{request_tag} payment_method=#{payment_method}")

    response = nil
    if payment_method == 'wallet' && electric_bill_order.payment_method != 'wallet'
      Rails.logger.warn(
        "BuyPower confirm_subscription blocked wallet bill_order_id=#{electric_bill_order.id} payment_method=#{electric_bill_order.payment_method}"
      )
      return { status: 'error', message: 'Invalid payment method for wallet confirmation' }
    end

    if payment_method == 'wallet'
      raise 'user is inactive' unless electric_bill_order.user&.active

        wallet = user.wallet
        amount = electric_bill_order[:total_amount].to_d
        commission_balance = wallet.commission.to_d
        bonus_used =
          if use_commission && %w[VTU DATA].include?(electric_bill_order.service_type)
            [commission_balance, amount].min
          else
            0.to_d
          end
        wallet_debit = amount - bonus_used

        begin
          ActiveRecord::Base.transaction do
            wallet.lock!
            electric_bill_order.lock!

          if idempotency_key.present? && electric_bill_order.idempotency_key.blank?
            electric_bill_order.idempotency_key = idempotency_key
          end

          return { response: electric_bill_order, status: 'success' } if electric_bill_order.completed?
          if electric_bill_order.processing? || electric_bill_order.pending?
            return { response: electric_bill_order, status: 'pending' }
          end

            available_balance = wallet.ledger_available_balance
            has_money = wallet_debit <= 0 || available_balance >= wallet_debit

            raise 'Insufficient funds' unless has_money

            # Avoid 0-amount holds that would create misleading ledger entries.
            if wallet_debit.positive?
              WalletLedgerEntry.ensure_hold!(
                wallet: wallet,
                bill_order: electric_bill_order,
                amount: wallet_debit,
                reference: idempotency_key,
                metadata: { request_id: request_id }
              )
            end

            electric_bill_order.payment_method = payment_method
            electric_bill_order.use_commission = use_commission
            electric_bill_order.commission_used = bonus_used
            electric_bill_order.status = 'processing'
            electric_bill_order.save!
          end
      rescue ActiveRecord::RecordInvalid => e
        Rails.logger.error("Update failed: #{e.record.errors.full_messages.join(', ')}")
        return { status: 'error', message: e.record.errors.full_messages.to_sentence }
      end

      if sandbox_vtu_blocked?(body)
        message = 'VTU is not supported in BuyPower sandbox. Please use staging/live.'
        return handle_wallet_failure(
          electric_bill_order,
          payment_method,
          message,
          { message: message, responseCode: 'SANDBOX_UNSUPPORTED' },
          status: 'failed'
        )
      end

      debug_vend = (!Rails.env.production? || ENV['DEBUG_VEND_KEYS'].to_s == '1')
      if debug_vend
        Rails.logger.info(
          "[TV_FLOW] about_to_call_buypower action=vend service_type=#{electric_bill_order['service_type']} vertical=#{body[:vertical]}"
        )
      end
      call_started_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      vend_type_log = body[:vendType]
      if debug_vend
        Rails.logger.info(
          "BuyPower vend body keys=#{body.keys.sort} vertical=#{body[:vertical]} vendType_present=#{body.key?(:vendType)} vendType=#{body[:vendType].inspect}"
        )
      end
      Rails.logger.info(
        "BuyPower vend request start #{request_tag} bill_order_id=#{electric_bill_order&.id} service_type=#{electric_bill_order['service_type']} biller=#{electric_bill_order['biller']} vendType=#{vend_type_log}"
      )
      response = self.class.post('/vend', headers: @post_headers, body: body, timeout: PROVIDER_READ_TIMEOUT, open_timeout: PROVIDER_OPEN_TIMEOUT)
      if debug_vend
        http_status = response.respond_to?(:code) ? response.code : nil
        provider_code =
          if response.respond_to?(:parsed_response)
            response.parsed_response&.dig('responseCode')
          elsif response.is_a?(Hash)
            response['responseCode'] || response[:responseCode]
          end
        raw = safe_json_dump(response)
        success =
          if response.respond_to?(:success?)
            response.success?
          elsif response.is_a?(Hash)
            response['success'] || response[:success]
          end
        Rails.logger.info(
          "[BuyPower] response http_status=#{http_status} provider_code=#{provider_code} success=#{success.inspect} body=#{sanitize_provider_message(raw.to_s)[0, 300]}"
        )
      end
      call_duration_ms = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - call_started_at) * 1000).round
      success =
        if response.respond_to?(:success?)
          response.success?
        elsif response.is_a?(Hash)
          response['success'] || response[:success]
        end
      Rails.logger.info("BuyPower vend request finish #{request_tag} duration_ms=#{call_duration_ms} success=#{success.inspect}")
    elsif payment_method == 'card'
      if sandbox_vtu_blocked?(body)
        return { status: 'error', response: 'VTU is not supported in BuyPower sandbox. Please use staging/live.' }
      end
      debug_vend = (!Rails.env.production? || ENV['DEBUG_VEND_KEYS'].to_s == '1')
      if debug_vend
        Rails.logger.info(
          "[TV_FLOW] about_to_call_buypower action=vend service_type=#{electric_bill_order['service_type']} vertical=#{body[:vertical]}"
        )
      end
      call_started_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      vend_type_log = body[:vendType]
      if debug_vend
        Rails.logger.info(
          "BuyPower vend body keys=#{body.keys.sort} vertical=#{body[:vertical]} vendType_present=#{body.key?(:vendType)} vendType=#{body[:vendType].inspect}"
        )
      end
      Rails.logger.info(
        "BuyPower vend request start #{request_tag} bill_order_id=#{electric_bill_order&.id} service_type=#{electric_bill_order['service_type']} biller=#{electric_bill_order['biller']} vendType=#{vend_type_log}"
      )
      response = self.class.post('/vend', headers: @post_headers, body: body, timeout: PROVIDER_READ_TIMEOUT, open_timeout: PROVIDER_OPEN_TIMEOUT)
      if debug_vend
        http_status = response.respond_to?(:code) ? response.code : nil
        provider_code =
          if response.respond_to?(:parsed_response)
            response.parsed_response&.dig('responseCode')
          elsif response.is_a?(Hash)
            response['responseCode'] || response[:responseCode]
          end
        raw = safe_json_dump(response)
        success =
          if response.respond_to?(:success?)
            response.success?
          elsif response.is_a?(Hash)
            response['success'] || response[:success]
          end
        Rails.logger.info(
          "[BuyPower] response http_status=#{http_status} provider_code=#{provider_code} success=#{success.inspect} body=#{sanitize_provider_message(raw.to_s)[0, 300]}"
        )
      end
      call_duration_ms = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - call_started_at) * 1000).round
      success =
        if response.respond_to?(:success?)
          response.success?
        elsif response.is_a?(Hash)
          response['success'] || response[:success]
        end
      Rails.logger.info("BuyPower vend request finish #{request_tag} duration_ms=#{call_duration_ms} success=#{success.inspect}")
    else
      raise 'no payment method selected'
    end

    unless response.respond_to?(:success?)
      enqueue_reconciliation(electric_bill_order)
      return { status: 'pending', response: 'Payment pending...' }
    end

    if response.success?
      Rails.logger.info(
        "BuyPower vend success #{request_tag} provider_txn_id=#{response&.dig('data','id')} units_present=#{!!response&.dig('data','units')} token_present=#{!!response&.dig('data','token')}"
      )

      payment_method = payment_method
      units = response&.dig('data', 'units')
      token = response&.dig('data', 'token')
      transaction_id = response&.dig('data', 'id')
      message = response&.dig('message') || 'No error message'
      provider_payload = provider_response_payload(response)

      if response&.dig('error')
        return handle_wallet_failure(
          electric_bill_order,
          payment_method,
          message,
          provider_payload,
          status: 'failed'
        )
      end

      if payment_method == 'wallet'
        return handle_wallet_success(
          electric_bill_order,
          payment_method,
          use_commission,
          units,
          token,
          transaction_id,
          message,
          provider_payload
        )
      end

      if electric_bill_order.update(status: 'completed', payment_method: payment_method, use_commission: use_commission,
                                    units: units, token: token, transaction_id: transaction_id, reason: message)
        return { response: electric_bill_order, status: 'success' }
      end
    else
      error_message = response&.dig('message') || 'Upstream provider error'
      if payment_method == 'card' || electric_bill_order.payment_method == 'card'
        electric_bill_order.update(status: 'initialized', payment_method: payment_method, reason: "Vend failed: #{error_message}")
        return { response: error_message, status: 'error' }
      end

      provider_payload = provider_response_payload(response)
      provider_status = provider_status_from(response)
      provider_error =
        provider_payload&.dig('error') || provider_payload&.dig(:error) ||
        provider_payload&.dig('errors') || provider_payload&.dig(:errors)
      provider_message =
        provider_payload&.dig('result', 'data', 'message') ||
        provider_payload&.dig('data', 'message') ||
        provider_payload&.dig('result', 'message') ||
        provider_payload&.dig('message') ||
        provider_payload&.dig('error')
      if electric_bill_order['service_type'].to_s.strip.upcase == 'TV' &&
         (provider_message.to_s.downcase.include?('invalid account number') ||
          error_message.to_s.downcase.include?('invalid account number'))
        log_tv_invalid_account(
          provider_payload: provider_payload,
          bill_order: electric_bill_order,
          request_id: request_id
        )
      end
      if vtu_service_type?(electric_bill_order['service_type']) &&
         (Rails.env.development? || Rails.env.staging?) &&
         Config::Bills.base_url.to_s.include?('idev.')
        sanitized_message = sanitize_provider_message(provider_message.presence || error_message)
        response_code = provider_payload&.dig('responseCode') || provider_payload&.dig(:responseCode)
        Rails.logger.warn(
          "BuyPower VTU failure request_id=#{request_id || 'unknown'} bill_order_id=#{electric_bill_order.id} vertical=#{body[:vertical]} disco=#{body[:disco]} responseCode=#{response_code} message=#{sanitized_message}"
        )
      end

      if provider_message.to_s.downcase.include?('daily transaction count limit')
        Rails.logger.warn(
          "BuyPower wallet vend failed bill_order_id=#{electric_bill_order.id} reason=#{provider_message}"
        )
        return handle_wallet_failure(
          electric_bill_order,
          payment_method,
          provider_message,
          provider_payload,
          status: 'failed'
        )
      end
      if provider_error.present?
        return handle_wallet_failure(
          electric_bill_order,
          payment_method,
          provider_message.presence || error_message,
          provider_payload,
          status: 'failed'
        )
      end
      if %w[failed refund refunded reversed cancelled].include?(provider_status)
        return handle_wallet_failure(
          electric_bill_order,
          payment_method,
          error_message,
          provider_payload,
          status: provider_status == 'refund' || provider_status == 'refunded' ? 'refunded' : 'failed',
          force_refund: %w[refund refunded reversed].include?(provider_status)
        )
      end

      electric_bill_order.update(status: 'processing', payment_method: payment_method, reason: error_message, provider_response: provider_payload)
      enqueue_reconciliation(electric_bill_order)
      return { status: 'pending', response: 'Payment processing...' }
    end

    return { response: electric_bill_order, status: 'success' }
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.error("Update failed: #{e.record.errors.full_messages.join(', ')}")
    return { status: 'error', message: e.record.errors.full_messages.to_sentence }
  rescue Timeout::Error, Net::OpenTimeout, Net::ReadTimeout => e
    electric_bill_order.update(status: 'processing', payment_method: payment_method)
    Rails.logger.info("BuyPower vend request timeout #{request_tag} error=#{e.class}")
    enqueue_reconciliation(electric_bill_order)
    return { status: 'pending', response: 'Payment pending...', code: 503 }
  rescue StandardError => e
    if electric_bill_order&.status == 'completed' && electric_bill_order&.transaction_id.present?
      Rails.logger.error(
        "BuyPower confirm_subscription error after completion #{request_tag} status=#{electric_bill_order.status} error=#{e.class} message=#{e.message}"
      )
      return { response: electric_bill_order, status: 'success' }
    end
    Rails.logger.error(
      "BuyPower confirm_subscription error #{request_tag} status=#{electric_bill_order&.status} error=#{e.class} message=#{e.message}"
    )
    return { response: e.message.to_s, status: 'error' }
  end

  def confirm_subscription_monnify(electric_bill_order, payment_method = 'wallet')
    payment_service = PaymentService.new
    response_service = payment_service.init_transaction(electric_bill_order)


    return response_service

    body = build_vend_body(
      electric_bill_order,
      phone:
        electric_bill_order['phone'].presence ||
        (electric_bill_order['service_type'] == 'TV' ? '07064334160' : electric_bill_order['meter_number'])
    )


    begin
      response = nil
      if payment_method == 'wallet'
        wallet = electric_bill_order.user.wallet
        available_balance = wallet.ledger_available_balance

        raise 'Insufficient funds' unless available_balance > electric_bill_order[:usd_amount].to_d

        # Timeout.timeout(120) do
        response = self.class.post('/vend', headers: @post_headers, body: body)
      # end





      elsif payment_method == 'card'
        Timeout.timeout(120) do
          response = self.class.post('/vend', headers: @post_headers, body: body)
        end
      else
        raise 'no payment method selected'


      end


      raise response['message'] unless response.success?

      electric_bill_order.update(status: 'completed', payment_method: payment_method,
                                 units: response['data']['units'], token: response['data']['token'], transaction_id: response['data']['id'])
      { response: electric_bill_order, status: 'success' }
    rescue Timeout::Error
      electric_bill_order.update(status: 'timedout')
      { response: 'The request timed out. Please try again', code: 504, status: 'TIMEOUT' }
    rescue StandardError => e
      { response: e.message.to_s, status: 'error' }
    end
  end

  def repurchase_subscription(current_user, bill_order)
    electric_bill_order = current_user.bill_orders.new(
      meter_number: bill_order[:meter_number],
      meter_type: bill_order [:meter_type],
      address: bill_order[:address],
      name: bill_order[:name],
      tariff_class: bill_order[:tariff_class],
      service_type: bill_order[:service_type],
      email: bill_order[:email],
      amount: bill_order[:amount],
      phone: bill_order[:phone],
      biller: bill_order[:biller]
    )




    raise bill_order.errors.full_messages.to_sentence unless electric_bill_order.save

    confirm_subscription(electric_bill_order)
  rescue StandardError => e
    { response: e.message.to_s, status: 'error' }
  end

  def get_wallet_balance
    response = self.class.get('/wallet/balance', headers: @post_headers, body: body)

    raise response['message'] unless response.success?

    { response: response, status: 'success' }
  rescue StandardError => e
    { response: e.message.to_s, status: 'error' }
  end

  require 'timeout'

def get_list(service_type, provider)
  return { response: 'provider and service_type are required', status: 'error' } if service_type.blank? || provider.blank?

  query = URI.encode_www_form(vertical: service_type.to_s, provider: provider.to_s)

  request_tag = "vertical=#{service_type} provider=#{provider}"
  Rails.logger.info("BuyPower tariff request start #{request_tag}")

  call_started_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)

  response = Timeout.timeout(PROVIDER_OPEN_TIMEOUT + PROVIDER_READ_TIMEOUT + 2) do
    self.class.get(
      "/tariff/?#{query}",
      headers: @get_headers,
      timeout: PROVIDER_READ_TIMEOUT,
      open_timeout: PROVIDER_OPEN_TIMEOUT
    )
  end

  call_duration_ms = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - call_started_at) * 1000).round
  Rails.logger.info("BuyPower tariff request finish #{request_tag} duration_ms=#{call_duration_ms} success=#{response&.success?}")

  raise response['message'] unless response.success?
  { response: response['data'], status: 'success' }

rescue Timeout::Error, Net::OpenTimeout, Net::ReadTimeout => e
  Rails.logger.error("BuyPower tariff timeout #{request_tag} error=#{e.class}")
  { response: 'Provider timeout. Please try again.', status: 'error', code: 503 }
rescue StandardError => e
  Rails.logger.error("BuyPower tariff error #{request_tag} error=#{e.class} message=#{e.message}")
  { response: e.message.to_s, status: 'error' }
end



  def re_query(order_id)
    response = self.class.get("/transaction/#{order_id}", headers: @get_headers)

    raise response['message'] || response unless response.success?

    { response: response, status: :ok }
  rescue StandardError => e
    { response: e.message.to_s, status: :unprocessable_entity }
  end

  private
  def build_vend_body(electric_bill_order, phone:)
    body = {
      meter: electric_bill_order['meter_number'],
      amount: electric_bill_order['amount'],
      orderId: electric_bill_order['id'],
      phone: phone,
      disco: electric_bill_order['biller'],
      vertical: electric_bill_order['service_type'],
      paymentType: electric_bill_order['payment_type'],
      name: electric_bill_order['name'],
      email: electric_bill_order['email'],
      tariffClass: electric_bill_order['tariff_class']
    }

    service_type = electric_bill_order['service_type'].to_s.strip.upcase
    if %w[ELECTRICITY TV].include?(service_type)
      raw_vend_type = electric_bill_order['meter_type']
      vend_type = raw_vend_type.to_s.strip.upcase.presence
      allowed = %w[PREPAID POSTPAID RECOVERY]

      if service_type == 'TV'
        vend_type = 'PREPAID' unless allowed.include?(vend_type)
        body[:vendType] = vend_type
      else
        raise "Missing/invalid vendType for electricity: #{vend_type.inspect}" unless allowed.include?(vend_type)

        body[:vendType] = vend_type
      end
    elsif %w[VTU DATA].include?(service_type)
      body[:vendType] = 'PREPAID'
    end

    body.delete(:vendType) unless %w[ELECTRICITY TV VTU DATA].include?(service_type)
    body.delete(:vendType) if body[:vendType].to_s.strip == ''

    assert_vend_type_rules!(service_type, body) if Rails.env.test?

    body.transform_values { |v| v.is_a?(String) ? v.strip : v }
  end

  def provider_response_payload(response)
    return response.parsed_response if response.respond_to?(:parsed_response)
    return response.to_h if response.respond_to?(:to_h)
    response
  end

  def provider_status_from(response)
    response&.dig('data', 'status')&.to_s&.downcase ||
      response&.dig('status')&.to_s&.downcase ||
      response&.dig('responseCode')&.to_s&.downcase
  end

  def log_tv_invalid_account(provider_payload:, bill_order:, request_id:)
    data_message =
      provider_payload&.dig('data', 'message') ||
      provider_payload&.dig(:data, :message) ||
      provider_payload&.dig('result', 'data', 'message') ||
      provider_payload&.dig(:result, :data, :message)

    sanitized = {
      responseCode: provider_payload&.dig('responseCode') || provider_payload&.dig(:responseCode),
      status: provider_payload&.dig('status') || provider_payload&.dig(:status),
      message: redact_account_identifier(provider_payload&.dig('message') || provider_payload&.dig(:message)),
      error: redact_account_identifier(provider_payload&.dig('error') || provider_payload&.dig(:error)),
      data_message: redact_account_identifier(data_message)
    }.compact

    Rails.logger.warn(
      "[BuyPower TV invalid account] request_id=#{request_id || 'unknown'} bill_order_id=#{bill_order&.id} payload=#{sanitized.to_json}"
    )
  end

  def redact_account_identifier(value)
    return value unless value.is_a?(String)

    value.gsub(/\d{6,}/) { |m| ('*' * [m.length - 4, 0].max) + m[-4, 4] }
  end

  def sanitize_provider_message(message)
    return message unless message.is_a?(String)

    message.gsub(/\d{6,}/) { |m| ('*' * [m.length - 4, 0].max) + m[-4, 4] }
  end

  def safe_json_dump(response)
    if response.respond_to?(:body)
      response.body.to_s
    else
      begin
        response.to_json
      rescue StandardError
        response.to_s
      end
    end
  end

  def vtu_service_type?(service_type)
    %w[VTU AIRTIME DATA].include?(service_type.to_s.strip.upcase)
  end

  def sandbox_vtu_blocked?(body)
    return false unless (Rails.env.development? || Rails.env.staging?)
    return false unless Config::Bills.base_url.to_s.include?('idev.')

    vtu_service_type?(body[:vertical])
  end

  def assert_vend_type_rules!(service_type, body)
    normalized = service_type.to_s.strip.upcase
    if %w[VTU AIRTIME DATA].include?(normalized)
      raise "vendType must be absent for #{normalized}" if body.key?(:vendType)
    elsif normalized == 'TV'
      raise 'vendType must be present for TV' unless body[:vendType].to_s.strip == 'PREPAID'
    elsif normalized == 'ELECTRICITY'
      allowed = %w[PREPAID POSTPAID RECOVERY]
      raise 'vendType must be valid for ELECTRICITY' unless allowed.include?(body[:vendType].to_s.strip)
    end
  end

    def handle_wallet_success(order, payment_method, use_commission, units, token, transaction_id, message, provider_payload)
      wallet = order.user.wallet
      amount = order.total_amount.to_d
      bonus_used = order.commission_used.to_d
      if bonus_used <= 0 && use_commission && %w[VTU DATA].include?(order.service_type)
        commission_balance = wallet.commission.to_d
        bonus_used = [commission_balance, amount].min
      end

      ActiveRecord::Base.transaction do
        wallet.lock!

        order.update!(
          status: 'completed',
          payment_method: payment_method,
          use_commission: use_commission,
          commission_used: bonus_used,
          units: units,
          token: token,
          transaction_id: transaction_id,
          provider_reference: transaction_id,
          provider_response: provider_payload,
          reason: message
        )

        BillOrders::Finalizer.call(bill_order: order)
      end

    { response: order, status: 'success' }
  end

  def handle_wallet_failure(order, payment_method, message, provider_payload, status: 'failed', force_refund: false)
    if order&.status && BillOrder::TERMINAL_STATUSES.include?(order.status.to_s)
      return { response: message, status: 'ignored' }
    end

    wallet = order.user.wallet
    amount = order.total_amount.to_d

    ActiveRecord::Base.transaction do
      wallet.lock!
      safe_release_hold!(
        wallet: wallet,
        bill_order: order,
        amount: amount,
        reference: order.idempotency_key,
        metadata: { provider_reference: order.provider_reference }
      )

      if (force_refund || WalletLedgerEntry.exists?(bill_order: order, entry_type: :debit)) &&
           !WalletLedgerEntry.exists?(bill_order: order, entry_type: :refund)
        WalletLedgerEntry.record_refund!(
          wallet: wallet,
          bill_order: order,
          amount: amount,
          reference: order.idempotency_key,
          metadata: { provider_reference: order.provider_reference }
        )
      end

      order.update!(
        status: status,
        payment_method: payment_method,
        provider_response: provider_payload,
        reason: message
      )
    end

    { response: message, status: 'error' }
  end

  def enqueue_reconciliation(order)
    return unless order&.id

    BuyPowerReconcileJob.set(wait: 2.minutes).perform_later(order.id)
  rescue StandardError
    nil
  end

  def safe_release_hold!(wallet:, bill_order:, amount:, reference:, metadata:)
    return unless WalletLedgerEntry.exists?(bill_order: bill_order, entry_type: :hold)
    return if WalletLedgerEntry.exists?(bill_order: bill_order, entry_type: :release)
    return if WalletLedgerEntry.debit_exists?(wallet: wallet, bill_order: bill_order)

    WalletLedgerEntry.release_hold!(
      wallet: wallet,
      bill_order: bill_order,
      amount: amount,
      reference: reference,
      metadata: metadata
    )
  end
end
