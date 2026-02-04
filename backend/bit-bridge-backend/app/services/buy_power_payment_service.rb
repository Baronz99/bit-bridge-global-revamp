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
  PENDING_USER_MESSAGE = 'Transaction is being processed. You will be notified once confirmed.'
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

    vend_type_param = payment_processor_params[:vendType] || payment_processor_params[:vend_type] || payment_processor_params[:meter_type]
    vend_type_normalized = vend_type_param.to_s.strip.upcase
    allowed_vend_types = %w[PREPAID POSTPAID RECOVERY]
    vend_type_normalized = 'PREPAID' if vend_type_normalized.blank? || !allowed_vend_types.include?(vend_type_normalized)

    resolved_meter_type =
      if is_electricity
        res&.dig('vendType') || vend_type_normalized
      elsif service_type_upcase == 'TV'
        vend_type_normalized
      else
        'PREPAID'
      end

    if service_type_upcase == 'TV'
      amount_raw = payment_processor_params[:amount]
      return { response: 'Amount is required', status: 'error' } if amount_raw.nil? || amount_raw == ''
      return { response: 'Invalid amount', status: 'error' } unless valid_amount?(amount_raw)
      return { response: 'tariff_class is required', status: 'error' } if payment_processor_params[:tariff_class].blank?
    end

    name_value = res&.dig('name')
    address_value = res&.dig('address')
    provider_response_value = nil
    if service_type_upcase == 'TV'
      verify_response =
        verify_tv_account(
          billersCode: payment_processor_params[:billersCode],
          biller: payment_processor_params[:biller],
          service_type: 'TV',
          vend_type: resolved_meter_type
        )
      provider_response_value = provider_response_payload(verify_response[:response])
      tv_ok = tv_verify_success?(provider_response_value)
      name_value = tv_ok ? extract_tv_name(provider_response_value).presence : nil
      if !Rails.env.production? || ENV['DEBUG_TV_VERIFY_KEYS'].to_s == '1'
        response_code = provider_response_value.is_a?(Hash) ? (provider_response_value['responseCode'] || provider_response_value[:responseCode]) : nil
        error_flag = provider_response_value.is_a?(Hash) ? provider_response_value['error'] : nil
        message_value = provider_response_value.is_a?(Hash) ? provider_response_value['message'] : nil
        Rails.logger.info(
          "[TV_VERIFY] gating responseCode=#{response_code} error=#{error_flag.inspect} message=#{message_value.inspect} extracted_name=#{name_value.inspect} tv_verify_success=#{tv_ok}"
        )
      end
      address_value = nil
    end

    name_for_record =
      service_type_upcase == 'TV' ? name_value : (name_value || payment_processor_params[:billersCode])
    address_for_record =
      service_type_upcase == 'TV' ? address_value : (address_value || payment_processor_params[:billersCode])

    bill_order = current_user&.bill_orders&.new(
      meter_number: payment_processor_params[:billersCode],
      meter_type: resolved_meter_type,
      address: address_for_record,
      name: name_for_record,
      tariff_class: payment_processor_params[:tariff_class],
      service_type: service_type,
      email: current_user.email || payment_processor_params[:email],
      amount: payment_processor_params[:amount],
      phone: current_user.user_profile&.phone_number || payment_processor_params[:phone],
      biller: payment_processor_params[:biller],
      description: payment_processor_params[:description],
      provider_response: provider_response_value,
      demand_category: res&.dig('demandCategory')
    ) || BillOrder.new(
      meter_number: payment_processor_params[:billersCode],
      meter_type: resolved_meter_type,
      address: address_for_record,
      name: name_for_record,
      tariff_class: payment_processor_params[:tariff_class],
      service_type: service_type,
      email: payment_processor_params[:email],
      amount: payment_processor_params[:amount],
      phone: payment_processor_params[:phone],
      biller: payment_processor_params[:biller],
      description: payment_processor_params[:description],
      provider_response: provider_response_value,
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

    if service_type == 'TV' && (!Rails.env.production? || ENV['DEBUG_TV_VERIFY_KEYS'].to_s == '1')
      payload =
        if response.respond_to?(:parsed_response)
          response.parsed_response
        elsif response.respond_to?(:to_h)
          response.to_h
        else
          response
        end
      top_keys = payload.is_a?(Hash) ? payload.keys : []
      data_keys = payload.is_a?(Hash) && payload['data'].is_a?(Hash) ? payload['data'].keys : []
      result_keys =
        if payload.is_a?(Hash) && payload['result'].is_a?(Hash)
          payload['result'].keys
        else
          []
        end
      result_data_keys =
        if payload.is_a?(Hash) && payload.dig('result', 'data').is_a?(Hash)
          payload.dig('result', 'data').keys
        else
          []
        end
      name_paths = []
      if payload.is_a?(Hash)
        name_paths << 'name' if payload.key?('name')
        name_paths << 'customerName' if payload.key?('customerName')
        name_paths << 'customer_name' if payload.key?('customer_name')
        if payload['data'].is_a?(Hash)
          name_paths << 'data.name' if payload['data'].key?('name')
          name_paths << 'data.customerName' if payload['data'].key?('customerName')
          name_paths << 'data.customer_name' if payload['data'].key?('customer_name')
        end
        if payload['result'].is_a?(Hash) && payload['result']['data'].is_a?(Hash)
          result_data = payload['result']['data']
          name_paths << 'result.data.name' if result_data.key?('name')
          name_paths << 'result.data.customerName' if result_data.key?('customerName')
          name_paths << 'result.data.customer_name' if result_data.key?('customer_name')
        end
      end
      Rails.logger.info(
        "[TV_VERIFY] response_keys top=#{top_keys} data=#{data_keys} result=#{result_keys} result_data=#{result_data_keys} name_paths=#{name_paths}"
      )
    end

    raise response['message'] unless response.success?

    { response: response, status: 'success' }
  rescue StandardError => e
    { response: e.message.to_s, status: 'error' }
  end

  def extract_tv_name(response)
    return nil unless response.is_a?(Hash)

    response['name'] ||
      response['customerName'] ||
      response['customer_name'] ||
      response.dig('data', 'name') ||
      response.dig('data', 'customerName') ||
      response.dig('data', 'customer_name') ||
      response.dig('result', 'data', 'name') ||
      response.dig('result', 'data', 'customerName') ||
      response.dig('result', 'data', 'customer_name')
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
    endpoint = '/vend'
    if vtu_or_airtime?(electric_bill_order['service_type']) && endpoint != '/vend'
      Rails.logger.error("[BuyPower] VTU/AIRTIME must use /vend; overriding endpoint=#{endpoint.inspect} -> '/vend'")
      endpoint = '/vend'
    end
    if payment_method == 'wallet' && electric_bill_order.payment_method != 'wallet'
      Rails.logger.warn(
        "BuyPower confirm_subscription blocked wallet bill_order_id=#{electric_bill_order.id} payment_method=#{electric_bill_order.payment_method}"
      )
      log_commission_context(
        electric_bill_order,
        user,
        detail: 'invalid_payment_method',
        use_commission: false,
        commission_balance: nil,
        wallet_debit: 0
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

            unless has_money
              log_commission_context(
                electric_bill_order,
                user,
                detail: 'insufficient_funds',
                use_commission: use_commission,
                wallet_debit: wallet_debit,
                commission_balance: commission_balance,
                available_balance: available_balance
              )
              raise 'Insufficient funds'
            end

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
            electric_bill_order.commission_used = MoneyScale.normalize(bonus_used)
            electric_bill_order.wallet_amount_charged = MoneyScale.normalize(wallet_debit)
            electric_bill_order.reward_applied = MoneyScale.normalize(bonus_used)
            electric_bill_order.commission_used_cents = Money.to_cents(bonus_used, 'NGN')
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
      call_started_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      Rails.logger.info(
        "BuyPower request start #{request_tag} endpoint=#{endpoint} service_type=#{electric_bill_order['service_type']} biller=#{electric_bill_order['biller']} body_keys=#{body.keys.sort}"
      )
      if ENV['DEBUG_VEND_KEYS'].to_s == '1'
        Rails.logger.debug(
          "BuyPower /vend payload keys=#{body.keys.sort} vendType=#{body[:vendType].inspect} service_type=#{electric_bill_order['service_type']}"
        )
      end
      Rails.logger.info(
        "[BuyPower] POST base_uri=#{self.class.base_uri} path=#{endpoint} order_id=#{electric_bill_order.id} service_type=#{electric_bill_order['service_type']}"
      )
      response = self.class.post(endpoint, headers: @post_headers, body: body, timeout: PROVIDER_READ_TIMEOUT, open_timeout: PROVIDER_OPEN_TIMEOUT)
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
      Rails.logger.info("BuyPower request finish #{request_tag} endpoint=#{endpoint} duration_ms=#{call_duration_ms} success=#{success.inspect}")
    elsif payment_method == 'card'
      if sandbox_vtu_blocked?(body)
        return { status: 'error', response: 'VTU is not supported in BuyPower sandbox. Please use staging/live.' }
      end
      debug_vend = (!Rails.env.production? || ENV['DEBUG_VEND_KEYS'].to_s == '1')
      call_started_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      Rails.logger.info(
        "BuyPower request start #{request_tag} endpoint=#{endpoint} service_type=#{electric_bill_order['service_type']} biller=#{electric_bill_order['biller']} body_keys=#{body.keys.sort}"
      )
      if ENV['DEBUG_VEND_KEYS'].to_s == '1'
        Rails.logger.debug(
          "BuyPower /vend payload keys=#{body.keys.sort} vendType=#{body[:vendType].inspect} service_type=#{electric_bill_order['service_type']}"
        )
      end
      Rails.logger.info(
        "[BuyPower] POST base_uri=#{self.class.base_uri} path=#{endpoint} order_id=#{electric_bill_order.id} service_type=#{electric_bill_order['service_type']}"
      )
      response = self.class.post(endpoint, headers: @post_headers, body: body, timeout: PROVIDER_READ_TIMEOUT, open_timeout: PROVIDER_OPEN_TIMEOUT)
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
      Rails.logger.info("BuyPower request finish #{request_tag} endpoint=#{endpoint} duration_ms=#{call_duration_ms} success=#{success.inspect}")
    else
      raise 'no payment method selected'
    end

    provider_payload = provider_response_payload(response)
    http_status = response.respond_to?(:code) ? response.code.to_i : nil
    provider_code =
      if provider_payload.is_a?(Hash)
        provider_payload['responseCode'] || provider_payload[:responseCode]
      end
    provider_code = provider_code.to_i if provider_code.respond_to?(:to_i)

    data_response_code =
      if provider_payload.is_a?(Hash)
        provider_payload.dig('data', 'responseCode') || provider_payload.dig(:data, :responseCode)
      end
    data_response_code = data_response_code.to_i if data_response_code.respond_to?(:to_i)

    retried = false

    if vtu_service_type?(electric_bill_order['service_type']) &&
       ((provider_code.present? && provider_code >= 400) ||
        (data_response_code != 100))
      if please_requery?(provider_payload) && !retried
        retried = true
        sleep 12
        response = self.class.post(endpoint, headers: @post_headers, body: body, timeout: PROVIDER_READ_TIMEOUT, open_timeout: PROVIDER_OPEN_TIMEOUT)
        provider_payload = provider_response_payload(response)
        provider_code = provider_payload['responseCode'].to_i if provider_payload.is_a?(Hash)
        data_response_code = provider_payload.dig('data', 'responseCode').to_i if provider_payload.is_a?(Hash)
        goto_success = response.respond_to?(:success?) && response.success? && data_response_code == 100
        unless goto_success
          enqueue_reconciliation(electric_bill_order)
          return { status: 'pending', response: 'Payment pending... requery in progress' }
        end
      end
      message =
        if provider_payload.is_a?(Hash)
          provider_payload['message'] || provider_payload[:message] || 'Provider returned error'
        elsif provider_payload.respond_to?(:[]) # e.g., custom response object with [] defined
          provider_payload[:message] || provider_payload['message'] || 'Provider returned error'
        else
          'Provider returned error'
        end
      provider_reference =
        if provider_payload.is_a?(Hash)
          provider_payload.dig('data', 'id').to_s.presence
        end

      if payment_method == 'wallet'
        result = handle_wallet_failure(
          electric_bill_order,
          payment_method,
          message,
          provider_payload,
          status: 'failed'
        )
        result[:code] = 503 if http_status && http_status >= 500
        return result
      else
        electric_bill_order.update(
          status: 'failed',
          payment_method: payment_method,
          provider_reference: provider_reference,
          provider_response: provider_payload,
          reason: message
        )
        return { response: message, status: 'error' }
      end
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
      transaction_id = response&.dig('data', 'id').to_s
      message = response&.dig('message') || 'No error message'
      provider_payload ||= provider_response_payload(response)

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
                                    units: units, token: token, transaction_id: transaction_id, provider_reference: transaction_id, reason: message)
        return { response: electric_bill_order, status: 'success' }
      end
    else
      error_message = response&.dig('message') || 'Upstream provider error'
      http_status = response.respond_to?(:code) ? response.code.to_i : nil
      provider_payload = provider_response_payload(response)

      if payment_method == 'card' || electric_bill_order.payment_method == 'card'
        electric_bill_order.update(status: 'initialized', payment_method: payment_method, reason: "Vend failed: #{error_message}")
        return { response: error_message, status: 'error' }
      end

      if http_status && http_status >= 500
        result = handle_wallet_failure(
          electric_bill_order,
          payment_method,
          'Provider temporarily unavailable. Try again.',
          provider_payload,
          status: 'failed'
        )
        return result.merge(code: 503)
      end

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

      provider_reference =
        if provider_payload.is_a?(Hash)
          provider_payload.dig('data', 'id') ||
            provider_payload.dig('data', 'transactionId') ||
            provider_payload.dig('data', 'transaction_id') ||
            provider_payload.dig('data', 'reference') ||
            provider_payload.dig('data', 'ref')
        end

      if provider_reference.blank?
        message = provider_message.presence || error_message.presence || 'Provider did not return a reference'
        return handle_wallet_failure(
          electric_bill_order,
          payment_method,
          message,
          provider_payload,
          status: 'failed'
        )
      end

      electric_bill_order.update(
        status: 'processing',
        payment_method: payment_method,
        reason: error_message,
        provider_response: provider_payload,
        provider_reference: provider_reference
      )
      enqueue_reconciliation(electric_bill_order)
      enqueue_processing_retry(electric_bill_order)
      return { status: 'pending', response: 'Payment processing...' }
    end

    return { response: electric_bill_order, status: 'success' }
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.error("Update failed: #{e.record.errors.full_messages.join(', ')}")
    return { status: 'error', message: e.record.errors.full_messages.to_sentence }
  rescue Timeout::Error, Net::OpenTimeout, Net::ReadTimeout => e
    Rails.logger.info("BuyPower vend request timeout #{request_tag} error=#{e.class}")
    return handle_wallet_failure(
      electric_bill_order,
      payment_method,
      'Provider timeout. Please try again.',
      { error: e.class.name, message: e.message },
      status: 'failed'
    ).merge(code: 503)
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
  http = self.class.get("/transaction/#{order_id}", headers: @get_headers)

  unless http.respond_to?(:success?) && http.success?
    msg =
      if http.respond_to?(:parsed_response)
        http.parsed_response
      else
        http
      end
    raise(msg.is_a?(Hash) ? (msg['message'] || msg[:message]) : msg.to_s)
  end

  payload =
    if http.respond_to?(:parsed_response)
      http.parsed_response
    elsif http.respond_to?(:to_h)
      http.to_h
    else
      http
    end

  { response: payload, status: :ok }
rescue StandardError => e
  { response: e.message.to_s, status: :unprocessable_entity }
end


  private
  def build_vend_body(electric_bill_order, phone:)
    vertical = electric_bill_order['service_type'].to_s.strip.upcase
    return BuyPowerPayloads.vtu(electric_bill_order, phone: phone) if vtu_or_airtime?(vertical)

    vend_type_raw = electric_bill_order['vendType'] ||
                    electric_bill_order['vend_type'] ||
                    electric_bill_order['vendtype'] ||
                    electric_bill_order['meter_type']
    vend_type = vend_type_raw.to_s.strip.upcase.presence || 'PREPAID'
    allowed_vend_types = %w[PREPAID POSTPAID RECOVERY]
    vend_type = 'PREPAID' unless allowed_vend_types.include?(vend_type)

    base = {
      amount: electric_bill_order['amount'],
      orderId: electric_bill_order['id'],
      phone: phone,
      vertical: vertical,
      paymentType: electric_bill_order['payment_type'],
      name: electric_bill_order['name'],
      email: electric_bill_order['email'],
      biller: electric_bill_order['biller']
    }

    case vertical
    when 'VTU', 'AIRTIME'
      # handled in BuyPowerPayloads.vtu (already returned)
      body = base
    when 'DATA'
      body = base.merge(
        tariffClass: electric_bill_order['tariff_class'],
        billersCode: electric_bill_order['meter_number'],
        disco: electric_bill_order['biller'],
        meter: electric_bill_order['meter_number'],
        vendType: vend_type
      )
    when 'TV', 'ELECTRICITY'
      raw_vend_type = electric_bill_order['meter_type']
      vend_type = raw_vend_type.to_s.strip.upcase.presence || vend_type
      allowed = %w[PREPAID POSTPAID RECOVERY]
      vend_type = 'PREPAID' unless allowed.include?(vend_type)
      electric_bill_order['meter_type'] = vend_type if electric_bill_order.respond_to?(:[]=)

      body = base.merge(
        meter: electric_bill_order['meter_number'],
        disco: electric_bill_order['biller'],
        tariffClass: electric_bill_order['tariff_class'],
        vendType: vend_type
      )
    else
      body = base.merge(vendType: vend_type)
    end

    body = body.compact

    assert_vend_type_rules!(vertical, body) if Rails.env.test?

    body.transform_values { |v| v.is_a?(String) ? v.strip : v }
  end

module BuyPowerPayloads
  def self.vtu(order, phone:)
    raw_vertical = order['service_type'].to_s.strip.upcase

    if raw_vertical.present? && !%w[VTU AIRTIME].include?(raw_vertical)
      Rails.logger.warn(
        "[BuyPower] VTU payload called with unexpected service_type=#{raw_vertical}; forcing vertical=VTU"
      )
    end

    {
      amount: order['amount'],
      orderId: order['id'],
      phone: phone,
      vertical: 'VTU',
      paymentType: order['payment_type'],
      name: order['name'],
      email: order['email'],
      biller: (order['biller'] || order['disco']).to_s.downcase.presence || order['biller'],
      disco: (order['biller'] || order['disco']).to_s.downcase.presence || order['biller'],
      meter: phone,
      vendType: 'PREPAID'
    }.compact
  end
end

  def provider_response_payload(response)
    return response.parsed_response if response.respond_to?(:parsed_response)
    return response.to_h if response.respond_to?(:to_h)
    response
  end

  def tv_verify_success?(payload)
    return false unless payload.is_a?(Hash)

    response_code = payload['responseCode'] || payload[:responseCode]
    error_flag = payload['error']

    return false unless response_code.to_s == '00'
    return false if error_flag == true

    true
  end

  def valid_amount?(raw)
    return false unless MoneyScale.valid_scale?(raw)

    BigDecimal(raw.to_s) > 0
  rescue ArgumentError
    false
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

  def vtu_or_airtime?(service_type)
    %w[VTU AIRTIME].include?(service_type.to_s.strip.upcase)
  end

  def sandbox_vtu_blocked?(body)
    return false unless (Rails.env.development? || Rails.env.staging?)
    return false unless Config::Bills.base_url.to_s.include?('idev.')

    vtu_service_type?(body[:vertical])
  end

  def assert_vend_type_rules!(service_type, body)
    normalized = service_type.to_s.strip.upcase
    if %w[VTU AIRTIME DATA].include?(normalized)
      raise "vendType must be PREPAID for #{normalized}" unless body[:vendType].to_s.strip == 'PREPAID'
    elsif normalized == 'TV'
      raise "vendType must be PREPAID for TV" unless body[:vendType].to_s.strip == 'PREPAID'
    elsif normalized == 'ELECTRICITY'
      allowed = %w[PREPAID POSTPAID RECOVERY]
      raise 'vendType must be valid for ELECTRICITY' unless allowed.include?(body[:vendType].to_s.strip)
    end
  end

  def please_requery?(payload)
    msg =
      if payload.is_a?(Hash)
        payload['message'] || payload[:message]
      else
        nil
      end
    msg.to_s.downcase.include?('please requery')
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

    upsert_transaction_record_provider_meta(order, provider_payload)
    { response: order, status: 'success' }
  end

  def handle_wallet_failure(order, payment_method, message, provider_payload, status: 'failed', force_refund: false)
    user_message = message.presence || PENDING_USER_MESSAGE

    if order&.status && BillOrder::TERMINAL_STATUSES.include?(order.status.to_s)
      return { response: user_message, status: 'ignored' }
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
        reason: user_message
      )
    end

    upsert_transaction_record_provider_meta(order, provider_payload)
    { response: user_message, status: 'error' }
  end

  def enqueue_reconciliation(order)
    return unless order&.id

    BuyPowerReconcileJob.set(wait: 2.minutes).perform_later(order.id)
  rescue StandardError
    nil
  end

  def enqueue_processing_retry(order)
    return unless order&.id

    wait_minutes = ENV.fetch('BUYPOWER_PROCESSING_REQUERY_MINUTES', 10).to_i
    wait_minutes = 10 if wait_minutes <= 0
    BuyPowerProcessingRetryJob.set(wait: wait_minutes.minutes).perform_later(order.id)
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

  def log_commission_context(order, user, detail:, use_commission:, wallet_debit:, commission_balance:, available_balance: nil)
    reward_balance = RewardTransaction.available_sum_for(user.id).to_d rescue 0
    pin_required = user&.transaction_pin_set?
    Rails.logger.warn(
      "[BONUS] confirm_subscription rejection detail=#{detail} bill_order_id=#{order&.id} user_id=#{user&.id} use_commission=#{use_commission} wallet_debit=#{wallet_debit} commission_balance=#{commission_balance} reward_balance=#{reward_balance} available_balance=#{available_balance} pin_required=#{pin_required}"
    )
  rescue StandardError => e
    Rails.logger.error("[BONUS] failed to log commission context #{e.class}: #{e.message}")
  end

  def upsert_transaction_record_provider_meta(order, provider_payload)
    return unless order

    response_code, response_message = provider_response_meta(provider_payload)
    return if response_code.blank? && response_message.blank?

    record = TransactionRecord.find_or_initialize_by(bill_order_id: order.id, event_type: 'bill_payment')
    record.reference ||= order.idempotency_key.presence || order.provider_reference.presence || order.transaction_id.presence || order.id.to_s
    record.status ||= order.status.to_s
    record.amount ||= (order.total_amount.presence || order.amount).to_d
    record.customer_name ||= order.name
    record.email ||= order.email
    record.phone_number ||= order.phone
    record.description ||= "#{order.service_type} #{order.biller}".strip
    record.transaction_id ||= order.provider_reference.presence || order.transaction_id
    record.response_code = response_code
    record.response_message = response_message
    record.provider_error_category = categorize_provider_error(response_message, response_code)
    record.save!
  rescue StandardError => e
    Rails.logger.error("[BuyPower] transaction_record meta update failed order=#{order&.id} #{e.class}: #{e.message}")
  end

  def provider_response_meta(provider_payload)
    return [nil, nil] unless provider_payload.is_a?(Hash)

    response_code =
      provider_payload['responseCode'] ||
      provider_payload[:responseCode] ||
      provider_payload.dig('data', 'responseCode') ||
      provider_payload.dig(:data, :responseCode) ||
      provider_payload['code'] ||
      provider_payload[:code]

    response_message =
      provider_payload['message'] ||
      provider_payload[:message] ||
      provider_payload.dig('data', 'message') ||
      provider_payload.dig(:data, :message) ||
      provider_payload.dig('result', 'message') ||
      provider_payload.dig(:result, :message) ||
      provider_payload['error'] ||
      provider_payload[:error]

    [response_code&.to_s, response_message&.to_s]
  end

  def categorize_provider_error(message, response_code)
    text = message.to_s.downcase

    return 'daily_limit' if text.include?('daily transaction count limit')
    return 'insufficient_funds' if text.include?('insufficient')
    return 'invalid_account' if text.include?('invalid account') || text.include?('invalid meter') || text.include?('invalid phone')
    return 'timeout' if text.include?('timeout')
    return 'provider_unavailable' if text.include?('temporarily unavailable') || text.include?('service unavailable')
    return 'network_error' if text.include?('network') || text.include?('connection')

    code = response_code.to_i rescue 0
    return 'provider_error' if code >= 400

    'unknown_error'
  end
end
