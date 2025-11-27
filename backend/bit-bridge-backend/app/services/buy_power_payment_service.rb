# frozen_string_literal: true

require 'uri'
class BuyPowerPaymentService
  include HTTParty

  base_uri Rails.env.production? ? 'https://api.buypower.ng/v2' : 'https://idev.buypower.ng/v2'
  # base_uri 'https://api.buypower.ng/v2'
  def initialize
    secret_token_dev = ENV['SECRET_TOKEN_DEV']
    secret_token_prod = ENV['SECRET_TOKEN_PROD']
    token = Rails.env.production? ? secret_token_prod : secret_token_dev

    @get_headers = {
      'Authorization' => "Bearer #{token}"

    }

    @post_headers = {
      'Authorization' => "Bearer #{token}"
    }
  end

  def process_payment(current_user, payment_processor_params)
    res = nil

    res = verify_meter(payment_processor_params) unless payment_processor_params[:skip] === true

    bill_order = current_user&.bill_orders&.new(
      meter_number: payment_processor_params[:billersCode],
      meter_type: res&.dig('vendType') || 'PREPAID',
      address: res&.dig('address') || payment_processor_params[:billersCode],
      name: res&.dig('name') || payment_processor_params[:billersCode],
      tariff_class: payment_processor_params[:tariff_class],
      service_type: payment_processor_params[:service_type],
      email: current_user.email || payment_processor_params[:email],
      amount: payment_processor_params[:amount],
      phone: current_user.user_profile&.phone_number || payment_processor_params[:phone],
      biller: payment_processor_params[:biller],
      description: payment_processor_params[:description],
      demand_category: res&.dig('demandCategory')
    ) || BillOrder.new(
      meter_number: payment_processor_params[:billersCode],
      meter_type: res&.dig('vendType') || 'PREPAID',
      address: res&.dig('address') || payment_processor_params[:billersCode],
      name: res&.dig('name') || payment_processor_params[:billersCode],
      tariff_class: payment_processor_params[:tariff_class],
      service_type: payment_processor_params[:service_type],
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

  def pay_data(electric_bill_order)
    body = {

      meter: electric_bill_order['meter_number'],
      amount: electric_bill_order['amount'],
      orderId: electric_bill_order['id'],
      vendType: electric_bill_order['meter_type'],
      phone: electric_bill_order['meter_number'],
      disco: electric_bill_order['biller'],
      vertical: electric_bill_order['service_type'],
      paymentType: electric_bill_order['payment_type'],
      name: electric_bill_order['name'],
      email: electric_bill_order['email'],
      tariffClass: electric_bill_order['tariff_class']
    }.transform_values { |v| v.is_a?(String) ? v.strip : v }


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

  def confirm_subscription(electric_bill_order, payment_method = 'wallet', use_commission = false)
    body = {
      meter: electric_bill_order['meter_number'],
      amount: electric_bill_order['amount'],
      orderId: electric_bill_order['id'],
      vendType: electric_bill_order['meter_type'],
      phone: electric_bill_order['phone'] || electric_bill_order['service_type'] == 'TV' ? '07064334160' : electric_bill_order['meter_number'],
      disco: electric_bill_order['biller'],
      vertical: electric_bill_order['service_type'],
      paymentType: electric_bill_order['payment_type'],
      name: electric_bill_order['name'],
      email: electric_bill_order['email'],
      tariffClass: electric_bill_order['tariff_class']
    }.transform_values { |v| v.is_a?(String) ? v.strip : v }

    user = electric_bill_order.user
    raise 'No user associated with this order' unless user

    user.with_lock do
      response = nil
      if payment_method == 'wallet'

        raise 'user is inactive' unless electric_bill_order.user&.active


        # update the order before transaction so you can update after transaction then check the previous transaction to ensure none was made at the same time
        wallet = user.wallet
        amount = electric_bill_order[:total_amount]
        use_commission = use_commission


        available_balance = wallet.balance.to_f
        commission_balance = wallet.commission.to_f || 0

        has_money = available_balance >= amount || (use_commission && (commission_balance + available_balance) >= amount)

        raise 'Insufficient funds' unless has_money

        # Timeout.timeout(180) do
        response = self.class.post('/vend', headers: @post_headers, body: body)
        # end

      elsif payment_method == 'card'
        Timeout.timeout(180) do
          response = self.class.post('/vend', headers: @post_headers, body: body)
        end
      else
        raise 'no payment method selected'
      end

      if response.success?

        Rails.logger.info("✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅✅Wallet transaction sucess: #{response}")

        payment_method = payment_method
        units = response&.dig('data', 'units')
        token = response&.dig('data', 'token')
        transaction_id = response&.dig('data', 'id')
        message = response['message'] || 'No error message'
        if response['error']
          electric_bill_order.update(status: 'disputed', payment_method: payment_method, reason: message)
          raise response['message']

        elsif electric_bill_order.update(status: 'completed', payment_method: payment_method, use_commission: use_commission,
                                         units: units, token: token, transaction_id: transaction_id, reason: message)
          unless electric_bill_order.update(status: 'completed', payment_method: payment_method,
                                            use_commission: use_commission, units: units, token: token, transaction_id: transaction_id, reason: message)
            electric_bill_order.update(status: 'disputed',
                                       reason: electric_bill_order&.full_messages&.to_sentence || message)
            raise electric_bill_order.full_messages.to_sentence
          end
        end
      else
        response['error']
        code = response['responseCode']
        electric_bill_order.update(status: 'declined', payment_method: payment_method, reason: response['message'])
        case code
        when 400, 422, 409, 500, 501, 502, 503, 403
        end
        raise response['message']
      end

      return { response: electric_bill_order, status: 'success' }
    rescue ActiveRecord::RecordInvalid => e
      Rails.logger.error("Update failed: #{e.record.errors.full_messages.join(', ')}")
      return { status: 'error', message: e.record.errors.full_messages.to_sentence }
    rescue Timeout::Error
      electric_bill_order.update(status: 'timedout', payment_method: payment_method)
      raise ActiveRecord::Rollback, 'Transaction TimedOut'
    rescue StandardError => e
      return { response: e.message.to_s, status: 'error' }
    end
  end

  def confirm_subscription_monnify(electric_bill_order, payment_method = 'wallet')
    payment_service = PaymentService.new
    response_service = payment_service.init_transaction(electric_bill_order)


    return response_service

    body = {
      meter: electric_bill_order['meter_number'],
      amount: electric_bill_order['amount'],
      orderId: electric_bill_order['id'],
      vendType: electric_bill_order['meter_type'],
      phone: electric_bill_order['service_type'] === 'ELECTRICITY' ? electric_bill_order['phone'] : electric_bill_order['meter_number'],
      disco: electric_bill_order['biller'],
      vertical: electric_bill_order['service_type'],
      paymentType: electric_bill_order['payment_type'],
      name: electric_bill_order['name'],
      email: electric_bill_order['email'],
      tariffClass: electric_bill_order['tariff_class']
    }.transform_values { |v| v.is_a?(String) ? v.strip : v }


    begin
      response = nil
      if payment_method == 'wallet'


        raise 'Insufficient funds' unless electric_bill_order.user.wallet.balance > electric_bill_order[:usd_amount]

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

  def get_list(service_type, provider)
    response = self.class.get("/tariff/?vertical=#{service_type}&provider=#{provider}", headers: @get_headers)
    raise response['message'] unless response.success?

    { response: response['data'], status: 'success' }
  rescue StandardError => e
    { response: e.message.to_s, status: 'error' }
  end

  def re_query(order_id)
    response = self.class.get("/transaction/#{order_id}", headers: @get_headers)

    raise response['message'] || response unless response.success?

    { response: response, status: :ok }
  rescue StandardError => e
    { response: e.message.to_s, status: :unprocessable_entity }
  end
end
