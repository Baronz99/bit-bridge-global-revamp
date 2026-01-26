# frozen_string_literal: true

class PaymentService
  include HTTParty

  # Use Rails config first (config.x.monnify_base_url), then ENV, then default sandbox.
  monnify_base_url =
    begin
      Rails.configuration.x.monnify_base_url
    rescue KeyError
      nil
    end
  base_uri(
    (monnify_base_url.is_a?(String) ? monnify_base_url.to_s.strip.presence : nil) ||
    ENV['MONNIFY_BASE_URL'].to_s.strip.presence ||
    'https://sandbox.monnify.com'
  )

  def initialize
    # Prefer values from config.x, fall back to ENV to avoid breaking existing prod config.
    config         = Rails.configuration.x
    config_secret =
      begin
        value = config.monnify_secret_key
        value.is_a?(String) ? value : nil
      rescue KeyError
        nil
      end
    config_api =
      begin
        value = config.monnify_api_key
        value.is_a?(String) ? value : nil
      rescue KeyError
        nil
      end
    config_contract =
      begin
        value = config.monnify_contract_code
        value.is_a?(String) ? value : nil
      rescue KeyError
        nil
      end

    secret_key     = (config_secret   || ENV['MONNIFY_SECRET_KEY']).to_s.strip
    api_key        = (config_api      || ENV['MONNIFY_API_KEY']).to_s.strip
    @contract_code = (config_contract || ENV['MONNIFY_CONTRACT_CODE']).to_s.strip

    missing = []
    missing << 'MONNIFY_API_KEY' if api_key.blank?
    missing << 'MONNIFY_SECRET_KEY' if secret_key.blank?
    missing << 'MONNIFY_CONTRACT_CODE' if @contract_code.blank?
    raise RuntimeError, "Missing #{missing.join(', ')}" if missing.any?

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
      "redirectUrl": (record_params[:redirect_url].presence || ENV.fetch("MONNIFY_REDIRECT_URL_DEFAULT", "https://bitbridgeglobal.com/app-redirect")),

      "paymentMethods":     %w[CARD ACCOUNT_TRANSFER],
      "metadata": {
        "name":           record_params[:customer_name] || record_params[:name],
        "paymentPurpose": record_params[:payment_purpose]
      }
    }

    body = body_hash.to_json

    response = self.class.post(
      '/api/v1/merchant/transactions/init-transaction',
      headers: headers,
      body:    body
    )

    unless response.success?
      message = response['responseMessage'] || response['message'] || "Monnify error #{response.code}"
      # ?. Never include request body in errors/logs
      raise message
    end

    { response: response, status: :ok }
  rescue StandardError => e
    # ?. Do NOT return request payload (contains customer PII)
    { message: e.message.to_s }
  end
end
