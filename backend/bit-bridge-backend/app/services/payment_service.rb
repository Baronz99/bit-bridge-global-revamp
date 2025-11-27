# frozen_string_literal: true

class PaymentService
  include HTTParty

  # Use Rails config first (config.x.monnify_base_url), then ENV, then default sandbox.
  base_uri(
    Rails.configuration.x.monnify_base_url ||
    ENV['MONNIFY_BASE_URL'] ||
    'https://sandbox.monnify.com'
  )

  def initialize
    # Prefer values from config.x, fall back to ENV to avoid breaking existing prod config.
    config         = Rails.configuration.x
    secret_key     = config.monnify_secret_key    || ENV['MONNIFY_SECRET_KEY']
    api_key        = config.monnify_api_key       || ENV['MONNIFY_API_KEY']
    @contract_code = config.monnify_contract_code || ENV['MONNIFY_CONTRACT_CODE']

    # If you ever need this later, it's still read here:
    ENV['MONNIFY_WALLET_ACCOUNT_NUMBER']

    encode_64 = Base64.strict_encode64("#{api_key}:#{secret_key}")

    @headers = {
      "Authorization": "Basic #{encode_64}",
      "Content-Type":  'application/json'
    }
  end

  def authenticate_and_store
    response = self.class.post('/api/v1/auth/login', headers: @headers)

    raise(response['responseMessage'] || 'bad request') unless response.success?

    monify_token = MonifyToken.create(
      token:      response['responseBody']['accessToken'],
      expires_in: Time.current + response['responseBody']['expiresIn']
    )
    raise monify_token.errors.full_messages.to_sentence unless monify_token.save

    monify_token
  rescue StandardError => e
    { response: e.message.to_s, status: :bad_request }
  end

  def get_token
    monify = MonifyToken.first
    return monify.token if monify.present? && monify.expires_in > Time.current

    monify = authenticate_and_store

    if monify.is_a?(Hash) && monify[:status] == :bad_request
      raise "Token authentication failed: #{monify[:response]}"
    end

    monify.token
  end

  def headers
    {
      "Authorization": "Bearer #{get_token}",
      "Content-Type":  'application/json'
    }
  end

  def create_wallet_account(account_params)
    body = {
      "accountReference":     "ref-#{Time.now.to_i}",
      "accountName":          account_params[:account_name],
      "currencyCode":         'NGN',
      "contractCode":         @contract_code,
      "customerEmail":        account_params[:email],
      "customerName":         account_params[:customer_name] || account_params[:name],
      "bvn":                  account_params[:bvn],
      "getAllAvailableBanks": true,
      "incomeSplitConfig": [
        {
          "subAccountCode": 'MFY_SUB_322165393053',
          "feePercentage":  10.5,
          "splitAmount":    20,
          "feeBearer":      true
        }
      ],
      "metaData": {
        "ipAddress":  '127.0.0.1',
        "deviceType": 'mobile'
      }
    }

    begin
      # Use Bearer token headers here
      response = self.class.post(
        'api/v1/bank-transfer/reserved-accounts',
        headers: headers,
        body:    body
      )

      raise response['responseMessage'] unless response.success?

      { response: response, status: :ok }
    rescue StandardError => e
      { message: e.message.to_s, body: body }
    end
  end

  def get_wallet_account(account_reference)
    response = self.class.get(
      "api/v1/bank-transfer/reserved-accounts/#{account_reference}",
      headers: headers
    )

    raise response['responseMessage'] unless response.success?

    { response: response, status: :ok }
  rescue StandardError => e
    { message: e.message.to_s }
  end

  def init_transaction(record_params)
    headers = {
      "Authorization": "Bearer #{get_token}",
      "Content-Type":  'application/json'
    }

    body_hash = {
      "amount":             record_params[:total_amount] || record_params[:amount],
      "customerName":       record_params[:customer_name] || record_params[:name],
      "customerEmail":      record_params[:email],
      "paymentReference":   record_params[:type].present? && record_params[:type] == 'bills' ?
                              "bbg-#{Time.now.to_i}" : "fbg-#{Time.now.to_i}",
      "paymentDescription": record_params[:description],
      "currencyCode":       'NGN',
      "contractCode":       @contract_code,
      "redirectUrl":        record_params[:redirect_url] || 'https://bitbridgeglobal.com/app-redirect',
      "paymentMethods":     %w[CARD ACCOUNT_TRANSFER],
      "metadata": {
        "name":           record_params[:customer_name] || record_params[:name],
        "paymentPurpose": record_params[:payment_purpose]
      }
    }

    body = body_hash.to_json

    # 🔍 Log what we’re sending to Monnify (for debugging)
    Rails.logger.info "Monnify init_transaction REQUEST body: #{body}"
    Rails.logger.info "Monnify init_transaction HEADERS: #{headers.inspect}"

    response = self.class.post(
      '/api/v1/merchant/transactions/init-transaction',
      headers: headers,
      body:    body
    )

    # 🔍 Log Monnify’s raw response so we can see the real error
    Rails.logger.error "Monnify init_transaction RESPONSE status=#{response.code} body=#{response.body}"

    unless response.success?
      # Try to surface Monnify's message if present
      message = response['responseMessage'] || response['message'] || "Monnify error #{response.code}"
      raise message
    end

    { response: response, status: :ok }
  rescue StandardError => e
    { message: e.message.to_s, body: body }
  end
end
