# frozen_string_literal: true

class AccountService
  include HTTParty

  # Keep existing behavior: production may use MONNIFY_BASE_URL_PROD, non-prod uses sandbox.
  base_uri Rails.env.production? ? ENV['MONNIFY_BASE_URL_PROD'] : 'https://sandbox.monnify.com'

  def initialize
    secret_key     = ENV['MONNIFY_SECRET_KEY'].to_s
    api_key        = ENV['MONNIFY_API_KEY'].to_s
    @contract_code = ENV['MONNIFY_CONTRACT_CODE'].to_s

    # still read (kept for compatibility)
    ENV['MONNIFY_WALLET_ACCOUNT_NUMBER']

    encode_64 = Base64.strict_encode64("#{api_key}:#{secret_key}")

    @headers = {
      "Authorization": "Basic #{encode_64}",
      "Content-Type":  'application/json'
    }
  end

  def authenticate_and_store
    response = self.class.post('/api/v1/auth/login', headers: @headers)
    raise response['responseMessage'] || 'bad request' unless response.success?

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
    raise "Token authentication failed: #{monify[:response]}" if monify.is_a?(Hash) && monify[:status] == :bad_request

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
      "accountReference":     account_params[:user_id],
      "accountName":          account_params[:account_name] || account_params[:customer_name],
      "currencyCode":         account_params[:currency].to_s.upcase,
      "contractCode":         @contract_code,
      "customerEmail":        account_params[:email],
      "customerName":         account_params[:customer_name] || account_params[:name],
      "bvn":                  account_params[:bvn],
      "getAllAvailableBanks": true
    }.to_json

    begin
      response = self.class.post('/api/v1/bank-transfer/reserved-accounts', headers: headers, body: body)
      raise response['responseMessage'] unless response.success?

      account = Account.new(
        account_number: response['responseBody']['accountNumber'],
        bank_code:      response['responseBody']['bankCode'],
        account_name:   response['responseBody']['accountName'],
        vendor:         account_params[:vendor] || 'monnify',
        user_id:        account_params[:user_id],
        bvn:            account_params[:bvn],
        currency:       account_params[:currency] || 'NGN'
      )
      raise account.errors.full_messages.to_sentence unless account.save

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

    default_redirect =
      ENV.fetch(
        "MONNIFY_REDIRECT_URL_DEFAULT",
        "https://bitbridgeglobal.com/app-redirect"
      ).to_s.strip

    redirect = record_params[:redirect_url].to_s.strip
    redirect = default_redirect if redirect.blank?

    if Rails.env.staging?
      prod_hosts = ["bitbridgeglobal.com", "www.bitbridgeglobal.com"]
      redirect = default_redirect if prod_hosts.any? { |h| redirect.include?(h) }
    end

    body = {
      "amount":             record_params[:amount],
      "customerName":       record_params[:customer_name] || record_params[:name],
      "customerEmail":      record_params[:email],
      "paymentReference":   (record_params[:type].present? && record_params[:type] == 'bills') ? "bbg-#{Time.now.to_i}" : "fbg-#{Time.now.to_i}",
      "paymentDescription": record_params[:description],
      "currencyCode":       'NGN',
      "contractCode":       @contract_code,
      "redirectUrl":        redirect,
      "paymentMethods":     %w[CARD ACCOUNT_TRANSFER],
      "metadata": {
        "name":           record_params[:customer_name] || record_params[:name],
        "paymentPurpose": record_params[:payment_purpose]
      }
    }.to_json

    response = self.class.post('/api/v1/merchant/transactions/init-transaction', headers: headers, body: body)
    raise response['responseMessage'] unless response.success?

    { response: response, status: :ok }
  rescue StandardError => e
    { message: e.message.to_s }
  end

  def get_reserved_account(account_reference)
    user = User.find_by(id: account_reference)
    return { message: 'User not found' } unless user
    return { message: 'Account already exists' } if user.account.present?

    begin
      response = self.class.get(
        "/api/v1/bank-transfer/reserved-accounts/#{account_reference}",
        headers: headers
      )
      raise response['responseMessage'] unless response.success?

      body = response['responseBody']

      account = Account.new(
        account_number: body['accountNumber'],
        bank_code:      body['bankCode'],
        account_name:   body['accountName'],
        vendor:         'monnify',
        user_id:        user.id,
        bvn:            user.bvn,
        currency:       'NGN'
      )
      raise account.errors.full_messages.to_sentence unless account.save

      { response: response, status: :ok }
    rescue StandardError => e
      { message: e.message.to_s }
    end
  end
end
