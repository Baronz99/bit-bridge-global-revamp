# frozen_string_literal: true

require 'digest'

class AnchorService
  include HTTParty

  SANDBOX_BASE_URL = 'https://api.sandbox.getanchor.co/'.freeze
  VERIFY_ACCOUNT_OPEN_TIMEOUT = 3
  VERIFY_ACCOUNT_READ_TIMEOUT = 5

  def initialize
    base_url = anchor_base_url
    api_key = anchor_api_key
    self.class.base_uri(base_url)

    @headers = {
      'x-anchor-key' => api_key,
      'Content-Type' => 'application/json'
    }
  end

  def create_individual_account(user_data)
    # Expected user_data:
    # { first_name:, last_name:, id:, email:, postal_code:, bvn:, city:, state:, dob:, phone_number:, address_line1: }

    first_name = user_data[:first_name]
    last_name    = user_data[:last_name]
    id           = user_data[:user_id]
    email = user_data[:email]
    postal_code = user_data[:postal_code]
    user_data[:bvn]
    city         = user_data[:city]
    state        = user_data[:state]
    user_data[:dob]
    phone_number = normalize_anchor_phone(user_data[:phone_number])
    address      = user_data[:address]

    body = {
      data: {
        type: 'IndividualCustomer',
        attributes: {
          fullName: {
            firstName: first_name,
            lastName: last_name
          },
          address: {
            addressLine_1: address,
            addressLine_2: address,
            city: city,
            state: state,
            country: 'NG',
            postalCode: postal_code
          },
          email: email,
          phoneNumber: phone_number,
          metadata: {
            my_customerID: id
          }
        }
      }
    }.to_json

    begin
      response = self.class.post('/api/v1/customers', headers: @headers, body: body)

      if response.success?
        account_id = response['data']['id']
        new_account = store_account_details(account_id, user_data)
        { response: new_account, status: :ok }

      else
        provider_status = response.code
        provider_body = response.parsed_response || response.body
        error_title = extract_anchor_error_message(response, fallback: 'bad request')
        raise StandardError.new(error_title.to_s)
      end
    rescue StandardError => e
      { message: e.message || 'bad request', status: :bad_request, provider_status: (defined?(provider_status) && provider_status) || nil, provider_body: (defined?(provider_body) && provider_body) || nil }
    end
  end

  def user_kyc_verification(kyc_data, account)
    bvn = kyc_data[:bvn] || account[:bvn]
    dob = kyc_data[:dob] || account[:dob]
    gender = kyc_data[:gender] || account[:gender]



    id = account.account_id
    body = {
      "data": {
        "type": 'Verification',
        "attributes": {
          "level": 'TIER_2',
          "level2": {
            "bvn": bvn,
            "dateOfBirth": dob,
            "gender": gender
          }
        }
      }
    }.to_json
    begin
      response = self.class.post("/api/v1/customers/#{id}/verification/individual", headers: @headers, body: body)

      raise extract_anchor_error_message(response, fallback: 'bad request') unless response.success?

      message = response&.dig('data', 'attributes', 'message')
      raise 'account  not found' unless account
      unless account.update(status: 'verifying', dob: dob, bvn: bvn, gender: gender)
        raise account.errors.full_messages.to_sentence || 'bad request'
      end

      # return {response: response["data"], message: message, status: :ok}
      { response: account, message: message, status: :ok }
    rescue StandardError => e
      message = e.message.to_s
      if message.downcase.include?('kyc already completed') && account.present?
        account.update(status: 'completed')
        return { response: account, message: 'Kyc already completed.', status: :ok }
      end
      { message: e.message || 'bad request', status: :bad_request }
    end
  end

  def create_account_number(type: :individual, account:)
    productType = 'SAVINGS'

    unless account.is_a?(Account)
      return { status: :bad_request, message: 'account must be an Account record' }
    end

    account_record = account

    id = account_record.account_id
    account_type = { individual: 'IndividualCustomer', corporate: 'CorporateCustomer' }
    body = {
      "data": {
        "type": 'DepositAccount',
        "attributes": {
          "productName": productType
        },
        "relationships": {
          "customer": {
            "data": {
              "id": id,
              "type": 'IndividualCustomer'
            }
          }
        }
      }
    }.to_json

    begin
      raise "Invalid account type, Must be one of #{account_type.keys.join(', ')}" unless account_type.key?(type)

      response = self.class.post('/api/v1/accounts', headers: @headers, body: body)
      # account_number = response&.dig("data", "attributes", "bank", "accountNumber")
      # bank_name = response&.dig("data", "attributes", "bank", "accountName")


      useable_id = response.dig('data', 'id')
      account_number = response.dig('data', 'attributes', 'accountNumber').to_s.strip
      account_name = response.dig('data', 'attributes', 'accountName')
      account_number_details = fetch_account_number_details_by_account_id(useable_id) || {}
      canonical_account_number = account_number_details[:account_number].to_s.strip
      fallback_account_number = numeric_account_number?(account_number) ? account_number : nil
      resolved_account_number = canonical_account_number.presence || fallback_account_number
      resolved_bank_name = account_number_details[:bank_name].presence || account_record.bank_name
      resolved_bank_code = account_number_details[:bank_code].presence || account_record.bank_code
      resolved_account_name = account_number_details[:account_name].presence || account_name
      log_bank_name_mismatch!(account_id: useable_id, canonical_bank_name: account_number_details[:bank_name])


      provider_status = response.code
      provider_body = response.parsed_response || response.body

      raise response.dig('errors', 0, 'detail') || 'bad request' unless response.success?

      base_updates = {
        account_type: type,
        active: true
      }
      base_updates[:useable_id] = useable_id if useable_id.present?
      base_updates[:bank_name] = resolved_bank_name if resolved_bank_name.present?
      base_updates[:bank_code] = resolved_bank_code if resolved_bank_code.present?
      base_updates[:account_name] = resolved_account_name if resolved_account_name.present?

      account_record.update(base_updates) if base_updates.any?

      if resolved_account_number.blank?
        return {
          status: :accepted,
          message: 'Anchor account created; account number pending',
          response: account_record,
          provider_status: provider_status,
          provider_body: provider_body
        }
      end

      success_updates = base_updates.merge(
        account_number: resolved_account_number,
        status: 'completed'
      )

      unless account_record.update(success_updates)

        account_record.errors.full_messages.to_sentence || 'bad request'
      end

      #  return   {response: response["data"], status: :ok}
      { response: account_record, status: :ok, provider_status: provider_status, provider_body: provider_body }
    rescue StandardError => e
      { response: e.message.to_s, message: e.message || 'bad request', status: :bad_request, provider_status: (defined?(provider_status) && provider_status) || nil, provider_body: (defined?(provider_body) && provider_body) || nil }
    end
  end

  def inboundDepositedFund(inboundTransferId)
    response = self.class.get("api/v1/inbound-transfers/#{inboundTransferId}", headers: @headers)
    return response if response.success?

    raise response['message'] || 'bad request'
  rescue StandardError => e
    e.message.to_s || 'bad request'
  end

  def fetch_bank_list
    fetch('get', 'banks', nil, nil)
  rescue StandardError => e
    { message: e.message.to_s || 'bad request' }
  end

  def verify_account_details(bank_id, account_number)
    path = "/api/v1/payments/verify-account/#{bank_id}/#{account_number}"
    response = self.class.get(
      path,
      headers: @headers,
      open_timeout: VERIFY_ACCOUNT_OPEN_TIMEOUT,
      timeout: VERIFY_ACCOUNT_READ_TIMEOUT
    )


    unless response.success?
      message = extract_anchor_error_message(response, fallback: 'bad request')
      raise message
    end

    { data: response, status: :ok }
  rescue StandardError => e
    { message: e.message.to_s || 'bad request', status: :bad_request }
  end

  def resolve_account_name(bank_code, account_number)
    response = verify_account_details(bank_code, account_number)
    return response unless response[:status] == :ok

    payload = response[:data] || {}
    data = payload['data'] || payload[:data] || payload
    attributes = data['attributes'] || data[:attributes] || {}

    account_name =
      attributes['accountName'] ||
      attributes['account_name'] ||
      data['accountName'] ||
      data[:accountName]
    bank_name =
      attributes.dig('bank', 'name') ||
      attributes.dig(:bank, :name) ||
      data.dig('bank', 'name')

    if account_name.blank?
      return { status: :bad_request, message: 'Account not found' }
    end

    { status: :ok, account_name: account_name, bank_name: bank_name }
  rescue StandardError => e
    { status: :bad_request, message: e.message.to_s }
  end

  def create_counter_party(transfer_params)
    params_hash = transfer_params.respond_to?(:to_h) ? transfer_params.to_h : transfer_params
    params_hash = params_hash.with_indifferent_access
    account_name = params_hash[:account_name].to_s.strip
    body = {
      data: {
        type: 'CounterParty',
        attributes: {
          bankCode: params_hash[:bank_code],
          accountNumber: params_hash[:account_number],
          verifyName: true
        }
      }
    }

    # Let Anchor resolve canonical account name from bank rails when verifyName is enabled.
    body[:data][:attributes][:accountName] = account_name if account_name.present?
    body_json = body.to_json
    request_headers = with_anchor_idempotency(
      headers: @headers,
      key: build_anchor_idempotency_key(
        prefix: 'counterparty',
        raw: "#{params_hash[:bank_code]}:#{params_hash[:account_number]}"
      )
    )

    begin
      response = self.class.post('/api/v1/counterparties', headers: request_headers, body: body_json)
      unless response.success?
        provider_status = response.code
        provider_body = response.parsed_response || response.body
        error_message = extract_anchor_error_message(response, fallback: 'bad request')
        Rails.logger.warn(
          "Anchor counterparty failed bank_code=#{params_hash[:bank_code]} account=#{params_hash[:account_number]} " \
          "status=#{provider_status} message=#{error_message}"
        )
        return {
          message: error_message.to_s,
          status: :bad_request,
          provider_status: provider_status,
          provider_body: provider_body
        }
      end

      anchor_id = response.dig('data', 'id')
      Rails.logger.info("Anchor counterparty created id=#{anchor_id}") if anchor_id
      { data: response['data'], status: :ok }
    rescue StandardError => e
      { message: e.message.to_s || 'bad request', status: :bad_request }
    end
  end
  def fetch_inbound_transfer(transfer_id)
    response = self.class.get("api/v1/inbound-transfers/#{transfer_id}", headers: @headers)
    return { status: :ok, data: response['data'] || response } if response.success?

    { status: :bad_request, message: response['message'].to_s.presence || response.message }
  rescue StandardError => e
    { status: :bad_request, message: e.message.to_s }
  end

  def normalize_anchor_phone(value)
    digits = value.to_s.gsub(/\D+/, '')
    return digits if digits.blank?

    if digits.start_with?('234') && digits.length == 13
      return digits
    end

    if digits.start_with?('0') && digits.length == 11
      return "234#{digits[1..]}"
    end

    if digits.length == 10
      return "234#{digits}"
    end

    digits
  end
  private :normalize_anchor_phone

  def get_inbound_transfer(transfer_id)
    response = self.class.get("api/v1/inbound-transfers/#{transfer_id}", headers: @headers)

    raise response['message'] || 'bad request' unless response.success?

    transaction_record = TransactionRecord.find_by(reference: transfer_id)
    return transaction_record.exchange if transaction_record&.exchange.present?
    return transaction_record.exchange if transaction_record.present?

    transaction_record = TransactionRecord.create!(reference: transfer_id, status: 'pending')

    receipient_id = response&.dig('relationships', 'account', 'data', 'id')
    raw_amount = response&.dig('attributes', 'amount')
    currency = response&.dig('attributes', 'currency') || 'NGN'
    amount, scale = normalize_anchor_amount(raw_amount, currency)
    sender = response&.dig('attributes', 'sourceAccountName')
    address = response&.dig('attributes', 'sourceAccountNumber')
    bank = response&.dig('attributes', 'sourceBank', 'name')

    account = Account.find_by(useable_id: receipient_id)

    user = account.user


    transaction_params = {
      wallet_id: user.wallet.id,
      amount: amount,
      address: address,
      account_name: sender,
      bank_code: bank,
      bank: bank,
      transaction_type: 'deposit',
      status: 'approved',
      coin_type: 'bank',
      metadata: {
        anchor_amount_raw: raw_amount,
        anchor_amount_scale: scale,
        currency: currency
      }
    }

    transaction = Transaction.new(transaction_params)
    transaction.save!

    transaction_record.update!(
      exchange: transaction,
      status: 'approved',
      description: 'Anchor inbound transfer',
      customer_name: sender,
      reference: transfer_id,
      account_number: address,
      bank_code: bank,
      bank: bank,
      amount: amount,
      transaction_id: transfer_id
    )

    transaction
  rescue ActiveRecord::RecordNotUnique
    TransactionRecord.find_by(reference: transfer_id)&.exchange
  rescue StandardError => e
    puts e.message
  end

  def initiate_transfer(transfer_params)
    # inter_bank=true means transfering to an external bank account over NIP rails.
    transfer_type = transfer_params[:inter_bank] ? 'NIPTransfer' : 'BookTransfer'
    recipient_name = transfer_params[:account_name]
    account_number = transfer_params[:account_number]
    source_name = transfer_params[:source_name]
    source_account_number = transfer_params[:source_account_number]
    initials = recipient_name.to_s.strip.split(' ').map { |name| name[0] }.join.downcase
    raw_reference = transfer_params[:reference].presence || "fbg#{Time.now.to_i}#{initials}"
    reference = normalize_transfer_reference(raw_reference)
    request_headers = with_anchor_idempotency(
      headers: @headers,
      key: build_anchor_idempotency_key(prefix: 'transfer', raw: reference)
    )
    counter_party_id = transfer_params[:counter_party_id]
    counter_party_id_type = 'CounterParty'
    bank_code = transfer_params[:bank_code]
    bank = 'anchor'
    recipient_bank = transfer_params[:bank] || transfer_params['bank']
    amount_kobo = ngn_to_kobo(transfer_params[:amount])
    relationships = if transfer_type == 'NIPTransfer'
                      {
                        account: {
                          data: {
                            id: transfer_params[:source_id],
                            type: 'DepositAccount'
                          }
                        },
                        counterParty: {
                          data: {
                            id: counter_party_id,
                            type: counter_party_id_type
                          }
                        }
                      }
                    else
                      {
                        destinationAccount: {
                          data: {
                            type: 'SubAccount',
                            id: account_number
                          }
                        },
                        account: {
                          data: {
                            type: 'SubAccount',
                            id: transfer_params[:source_id]
                          }
                        }
                      }
                    end

    # source_id is usuable_id from account model
    body = {
      data: {
        type: transfer_type,
        attributes: {
          amount: amount_kobo,
          currency: 'NGN',
          reason: sanitize_transfer_reason(transfer_params[:description]),
          reference: reference
        },
        relationships: relationships
      }
    }.to_json


    begin
      # Remove trailing space in URL and make POST request
      response = fetch('post', 'transfers', nil, body, headers: request_headers)

      # Use dig to safely access nested JSON keys
      transfer_id = response.dig(:data, 'id')
      status       = response.dig(:data, 'attributes', 'status')&.downcase
      amount       = response.dig(:data, 'attributes', 'amount')
      description  = response.dig(:data, 'attributes', 'reason')

      Rails.logger.info(
        "Anchor transfer created transfer_id=#{transfer_id} counter_party_id=#{counter_party_id} " \
        "reference=#{reference} amount_kobo=#{amount_kobo} type=#{transfer_type}"
      )

      {
        data: {
          transfer_id: transfer_id,
          status: status,
          amount: amount,
          description: description,
          reference: reference,
          bank_code: bank_code,
          bank: recipient_bank,
          account_number: account_number,
          account_name: recipient_name,
          source_name: source_name
        },
        status: :ok
      }
    rescue StandardError => e
      Rails.logger.error(
        "Anchor transfer failed counter_party_id=#{counter_party_id} reference=#{reference} amount_kobo=#{amount_kobo} " \
        "error=#{e.message}"
      )
      { message: e.message.presence || 'Bad request', status: :bad_request }
    end
  end

  def create_pay_with_transfer(reference:, amount:, customer_email:, customer_full_name:, expiry_time: 3600, provider: nil, metadata: {})
    attrs = {
      reference: reference.to_s,
      customer: {
        fullName: customer_full_name.to_s,
        email: customer_email.to_s
      },
      expiryTime: expiry_time.to_i.positive? ? expiry_time.to_i : 3600,
      amount: amount.to_i,
      metadata: metadata.presence || {}
    }
    attrs[:provider] = provider if provider.present?

    body = {
      data: {
        type: 'PayWithTransfer',
        attributes: attrs
      }
    }.to_json

    response = self.class.post('/pay/pay-with-transfer', headers: @headers, body: body)

    unless response.success?
      error_message = extract_anchor_error_message(response, fallback: 'bad request')
      return {
        status: :bad_request,
        message: error_message.to_s
      }
    end

    data = response['data'] || {}
    attributes = data['attributes'] || {}
    account = attributes['account'].is_a?(Hash) ? attributes['account'] : {}
    virtual_nuban = attributes['virtualNuban'].is_a?(Hash) ? attributes['virtualNuban'] : {}
    bank = account['bank'].is_a?(Hash) ? account['bank'] : {}

    details = {
      provider_reference: data['id'] || attributes['payInId'] || attributes['id'],
      account_number: account['accountNumber'] || virtual_nuban['accountNumber'],
      account_name: account['accountName'] || virtual_nuban['accountName'],
      bank_name: bank['name'],
      expiry_time: attributes['expiryTime'] || attributes['expiresAt'],
      raw: data
    }

    { status: :ok, data: data, details: details }
  rescue StandardError => e
    { status: :bad_request, message: e.message.to_s }
  end

  def fetch_payin(payin_id)
    return { status: :bad_request, message: 'payin_id is required' } if payin_id.blank?

    response = self.class.get("/pay-ins/#{payin_id}", headers: @headers)
    return { status: :ok, data: response['data'] || {} } if response.success?

    { status: :bad_request, message: response['message'].to_s.presence || response.message }
  rescue StandardError => e
    { status: :bad_request, message: e.message.to_s }
  end

  def verify_transfer_request(transferId)
    response = self.class.get("/api/v1/transfers/verify/#{transferId}", headers: @headers)
    return { data: response['data'], status: :ok } if response.success?

    raise response['message'] || 'bad request'
  rescue StandardError => e
    { message: e.message.to_s || 'bad request', status: :bad_request }
  end

  # Ensures we use a DepositAccount id (..-anc_acc) as transfer source.
  # Falls back to scanning account-numbers by account_number when local useable_id
  # is stale or points to a customer id.
  def ensure_transfer_source_account!(account_record)
    return account_record if account_record.blank?

    usable_id = account_record.useable_id.to_s
    return account_record if usable_id.end_with?('-anc_acc')

    resolved_id = resolve_deposit_account_id_by_account_number(account_record.account_number)
    return account_record if resolved_id.blank?

    account_record.update(useable_id: resolved_id) if account_record.useable_id != resolved_id
    account_record
  rescue StandardError => e
    Rails.logger.warn("[AnchorService] ensure_transfer_source_account failed account_id=#{account_record&.id} message=#{e.message}") if defined?(Rails) && Rails.logger
    account_record
  end

  def fetch_all_account_details
    response = self.class.get('/api/v1/account-numbers', headers: @headers)
    raise response['message'] || 'bad request' unless response.success?

    { data: response['data'], status: :ok }
  rescue StandardError => e
    { message: e.message.to_s || 'bad request', status: :bad_request }
  end

  def fetch_account_detail(account_id, view_account = true)
    base_url = "accounts/#{account_id}"

    query = view_account ? "?#{ { include: 'AccountNumber' }.to_query }" : ''
    fetch('get', base_url, query, nil)
  rescue StandardError => e
    { message: e.message.to_s || 'bad request', status: :bad_request }
  end

  def fetch_customer_detail(customer_id)
    return { message: 'customer_id is required' } if customer_id.blank?

    response = self.class.get("/api/v1/customers/#{customer_id}", headers: @headers)
    if response.success?
      { data: response['data'], status: :ok }
    else
      error_message = extract_anchor_error_message(response, fallback: 'Bad request')
      { message: error_message.to_s, status: :bad_request }
    end
  rescue StandardError => e
    { message: e.message.to_s || 'bad request', status: :bad_request }
  end

  def fund_deposit_account(data)
    payment = data.dig('attributes', 'payment') || {}
    account_id = payment.dig('settlementAccount', 'accountId')
    virtual_account_id = payment.dig('virtualNuban', 'accountId')
    virtual_account_number = payment.dig('virtualNuban', 'accountNumber')

    Rails.logger.info("✅  Anchor webhook userId: ======================== #{account_id} ")

    account = resolve_anchor_account(
      settlement_account_id: account_id,
      virtual_account_id: virtual_account_id,
      virtual_account_number: virtual_account_number
    )



    unless account
      raise "Anchor settlement account not mapped settlement_account_id=#{account_id} " \
            "virtual_account_id=#{virtual_account_id} virtual_account_number=#{virtual_account_number}"
    end

    raw_amount = payment['amount']
    currency = payment['currency'] || 'NGN'
    amount, scale = normalize_anchor_amount(raw_amount, currency)
    receiver_account_number = payment.dig('virtualNuban', 'accountNumber') || 'N/A'
    receiver_account_name = payment.dig('virtualNuban', 'accountName') || 'N/A'
    receiver_account_id = payment.dig('virtualNuban', 'accountId')
    bank = 'Anchor'
    bank_code = 'anchor'
    status =  'approved'
    description = payment['narration']
    sender_account_number = payment.dig('counterParty', 'accountNumber')
    sender_name = payment.dig('counterParty', 'accountName')
    sender_bank = payment.dig('counterParty', 'bank', 'name')
    reference = payment['paymentReference']
    payment_id = payment['paymentId']
    paid_at = payment['paidAt']
    provider_created_at = payment['createdAt']
    settlement_account_id = payment.dig('settlementAccount', 'accountId')
    payment_fee = payment['fee']
    payment_type = payment['type']

    # paymentId is Anchor's stable unique idempotency key for inbound payins.
    # Do not fall back to paymentReference when paymentId is present because
    # some references are reused and can collide with historical records.
    transaction_record = if payment_id.present?
                           TransactionRecord.find_by(transaction_id: payment_id)
                         else
                           TransactionRecord.find_by(reference: reference)
                         end
    if transaction_record.present?
      if transaction_record.event_type != 'anchor.webhook.payment.settled'
        transaction_record.update(event_type: 'anchor.webhook.payment.settled')
      end
      return transaction_record.exchange if transaction_record&.exchange.present?
      return transaction_record.exchange
    end


    Rails.logger.info("✅  Anchor webhook data: ========================  #{amount} #{sender_name}")





    user = account.user




    transaction_params = {
      wallet_id: user.wallet.id,
      amount: amount,
      address: sender_account_number,
      account_name: sender_name,
      bank_code: sender_bank,
      bank: sender_bank,
      transaction_type: 'deposit',
      status: 'approved',
      coin_type: 'bank',
      metadata: {
        provider: 'anchor',
        anchor_payment_id: payment_id,
        anchor_payment_reference: reference,
        anchor_narration: description,
        anchor_paid_at: paid_at,
        anchor_created_at: provider_created_at,
        anchor_fee: payment_fee,
        anchor_payment_type: payment_type,
        anchor_sender: {
          account_number: sender_account_number,
          account_name: sender_name,
          bank_name: sender_bank
        },
        anchor_virtual_account: {
          account_number: receiver_account_number,
          account_name: receiver_account_name,
          account_id: receiver_account_id
        },
        anchor_settlement_account_id: settlement_account_id,
        anchor_amount_raw: raw_amount,
        anchor_amount_scale: scale,
        currency: currency
      }
    }


    record_reference = payment_id.presence || reference
    transaction_record = TransactionRecord.create!(
      reference: record_reference,
      transaction_id: payment_id,
      status: status,
      event_type: 'anchor.webhook.payment.settled'
    )

    transaction = Transaction.new(transaction_params)
    transaction.save!

    Rails.logger.info("✅ Transaction saved successfully #{transaction.id}")





    transaction_record.update!(
      exchange: transaction,
      status: status,
      description: description.presence || 'Anchor inbound transfer',
      customer_name: sender_name.presence || receiver_account_name,
      reference: record_reference,
      transaction_id: payment_id,
      account_number: receiver_account_number,
      bank_code: bank_code,
      bank: sender_bank.presence || bank,
      amount: amount
    )
  rescue StandardError => e
    Rails.logger.error("[AnchorWebhook] fund_deposit_account failed message=#{e.message}")
    raise
  end

  def confirm_transfer_withdrawal(data)
    transfer_id = data.dig('relationships', 'transfer', 'data', 'id')

    raise 'Missing transfer ID in webhook payload' unless transfer_id

    transaction = Transaction.find_by(transfer_id: transfer_id)
    raise "Transaction not found for transfer ID: #{transfer_id}" unless transaction

    provider_status =
      data['type'].to_s.presence ||
      data.dig('attributes', 'status').to_s.presence ||
      'successful'

    Transfers::AnchorNgnTransferService.mark_success!(
      transaction,
      provider_status: provider_status,
      provider_transfer_id: transfer_id
    )
    Rails.logger.info("Anchor transfer approved transfer_id=#{transfer_id} transaction_id=#{transaction.id} status=#{provider_status}")
  end

  def fail_transfer_withdrawal(data)
    transfer_id = data.dig('relationships', 'transfer', 'data', 'id')
    unless transfer_id
      Rails.logger.warn('[AnchorWebhook] missing transfer ID for failure event')
      return
    end

    transaction = Transaction.find_by(transfer_id: transfer_id)
    unless transaction
      Rails.logger.warn("Anchor transfer failure: transaction not found transfer_id=#{transfer_id}")
      return
    end

    provider_status = data['type'].to_s
    reason =
      data.dig('attributes', 'failureReason') ||
      data.dig('attributes', 'reason') ||
      data.dig('attributes', 'message') ||
      'Transfer failed'

    Transfers::AnchorNgnTransferService.reverse_transfer!(
      transaction,
      reason: reason,
      provider_status: provider_status
    )
  end


  private

  def parsed_response_hash(response)
    payload = response.respond_to?(:parsed_response) ? response.parsed_response : nil
    payload.is_a?(Hash) ? payload : {}
  rescue StandardError
    {}
  end

  def extract_anchor_error_message(response, fallback:)
    payload = parsed_response_hash(response)
    raw_message =
      payload.dig('errors', 0, 'detail') ||
      payload['message'] ||
      payload['error'] ||
      (response.respond_to?(:message) ? response.message : nil)

    body_text = response.respond_to?(:body) ? response.body.to_s : ''
    combined = [raw_message.to_s, body_text].join(' ').downcase

    if combined.include?('undefined method') && combined.include?('dig')
      return 'Transfer provider is temporarily unavailable. Use another bank account or retry manually later.'
    end
    if combined.match?(/502|503|504|bad gateway|service unavailable|gateway timeout|upstream connect error/)
      return 'Transfer provider is temporarily unavailable. Use another bank account or retry manually later.'
    end
    if combined.match?(/timeout|timed out|execution expired/)
      return 'Transfer provider timed out. Use another bank account or retry manually later.'
    end

    candidate = raw_message.to_s.strip
    return candidate if candidate.present?

    fallback.to_s
  end

  def anchor_base_url
    primary = ENV['ANCHOR_BASE_URL'].to_s.strip
    fallback = ENV['DEV_ANCHOR_BASE_URL'].to_s.strip

    return primary if primary.present?
    raise RuntimeError, 'Missing ANCHOR_BASE_URL' if Rails.env.production?

    fallback.presence || SANDBOX_BASE_URL
  end

  def anchor_api_key
    primary = ENV['ANCHOR_API_KEY'].to_s.strip
    fallback = ENV['DEV_ANCHOR_API_KEY'].to_s.strip

    return primary if primary.present?
    raise RuntimeError, 'Missing ANCHOR_API_KEY' if Rails.env.production?

    return fallback if fallback.present?

    raise RuntimeError, 'Missing ANCHOR_API_KEY'
  end

  def raise_missing_anchor_env!
    return unless Rails.env.production?

    raise RuntimeError, 'Missing ANCHOR_BASE_URL or ANCHOR_API_KEY in production'
  end

  def store_account_details(account_id, user_data)
    resolved_vendor = user_data[:vendor].presence || 'anchor'
    existing_anchor = Account.where(user_id: user_data[:user_id])
                            .where("vendor = ? OR vendor IS NULL", resolved_vendor)
                            .order(
                              Arel.sql("CASE WHEN account_number IS NOT NULL AND account_number <> '' THEN 0 WHEN useable_id IS NOT NULL AND useable_id <> '' THEN 1 ELSE 2 END ASC"),
                              status: :desc,
                              updated_at: :desc,
                              created_at: :desc
                            )
                            .first

    attributes = {
      postal_code: user_data[:postal_code],
      bvn: user_data[:bvn],
      city: user_data[:city],
      state: user_data[:state],
      dob: user_data[:dob],
      address: user_data[:address],
      vendor: resolved_vendor
    }

    if existing_anchor.present?
      # Keep existing provisioned customer linkage stable; only backfill ids when incomplete.
      if existing_anchor.account_number.blank? || existing_anchor.account_id.blank?
        attributes[:account_id] = account_id
      end
      if existing_anchor.account_number.blank? || existing_anchor.useable_id.blank?
        attributes[:useable_id] = account_id
      end
      existing_anchor.update!(attributes.compact)
      return existing_anchor
    end

    new_account = Account.create(
      user_id: user_data[:user_id],
      account_id: account_id,
      useable_id: account_id,
      active: true,
      **attributes
    )

    raise new_account.errors.full_messages.to_sentence unless new_account.persisted?

    new_account
  end

  def fetch(method, api, params = '', body = nil, headers: nil)
    request_headers = headers || @headers
    response =
      case method.downcase
      when 'get'
        self.class.get("/api/v1/#{api}#{params}", headers: request_headers, body: body)
      when 'post'
        self.class.post("/api/v1/#{api}#{params}", headers: request_headers, body: body)
      else
        raise StandardError, 'Unsupported HTTP method'
      end

    if response.success?
      { data: response['data'], status: :ok }
    else
      error_message = extract_anchor_error_message(response, fallback: 'Bad request')
      raise StandardError, error_message
    end
  rescue StandardError => e
    raise StandardError, e.message
  end

  def fetch_account_number_by_account_id(account_id)
    details = fetch_account_number_details_by_account_id(account_id)
    details[:account_number]
  end

  def fetch_account_number_details_by_account_id(account_id)
    return nil if account_id.blank?

    response = self.class.get('/api/v1/account-numbers', headers: @headers, query: { AccountId: account_id })
    return nil unless response.success?

    data = response['data']
    row = data.is_a?(Array) ? data.first : data
    attributes = row.is_a?(Hash) ? (row['attributes'] || {}) : {}
    bank = attributes['bank'].is_a?(Hash) ? attributes['bank'] : {}

    {
      account_number: attributes['accountNumber'],
      bank_name: bank['name'],
      bank_code: bank['code'],
      account_name: attributes['name'].presence || attributes['accountName'].presence
    }.compact
  rescue StandardError
    nil
  end

  def sync_anchor_deposit_account!(account_record)
    return account_record if account_record.blank? || account_record.useable_id.blank?

    details = fetch_account_number_details_by_account_id(account_record.useable_id)
    return account_record if details.blank?

    updates = {}
    updates[:account_number] = details[:account_number] if details[:account_number].present? && details[:account_number] != account_record.account_number
    updates[:bank_name] = details[:bank_name] if details[:bank_name].present? && details[:bank_name] != account_record.bank_name
    updates[:bank_code] = details[:bank_code] if details[:bank_code].present? && details[:bank_code] != account_record.bank_code
    updates[:account_name] = details[:account_name] if details[:account_name].present? && details[:account_name] != account_record.account_name
    log_bank_name_mismatch!(account_id: account_record.useable_id, canonical_bank_name: details[:bank_name])

    account_record.update(updates) if updates.any?
    account_record
  rescue StandardError => e
    Rails.logger.warn("[AnchorService] sync_anchor_deposit_account failed account_id=#{account_record&.id} message=#{e.message}") if defined?(Rails) && Rails.logger
    account_record
  end

  def resolve_anchor_account(settlement_account_id:, virtual_account_id:, virtual_account_number:)
    scope = Account.where(vendor: 'anchor')

    if settlement_account_id.present?
      account = scope.find_by(useable_id: settlement_account_id)
      return account if account
    end

    if virtual_account_id.present?
      account = scope.find_by(useable_id: virtual_account_id)
      return account if account
    end

    if virtual_account_number.present?
      account = scope.find_by(account_number: virtual_account_number)
      return account if account
    end

    nil
  end

  def normalize_anchor_amount(amount, currency)
    raw = BigDecimal(amount.to_s)
    scale = ENV['ANCHOR_AMOUNT_SCALE'].to_s.downcase

    if scale == 'naira'
      return [raw, 'naira']
    end

    if scale == 'kobo'
      return [(raw / 100).round(2), 'kobo']
    end

    if currency.to_s.upcase == 'NGN' && raw.frac.zero? && raw >= 1000
      return [(raw / 100).round(2), 'kobo']
    end

    [raw, 'naira']
  rescue ArgumentError
    [amount, 'unknown']
  end

  def normalize_transfer_reference(reference)
    cleaned = reference.to_s.downcase.gsub(/[^a-z0-9]/, '')
    cleaned = "fbg#{Time.now.to_i}" if cleaned.blank?
    cleaned[0, 100]
  end

  def numeric_account_number?(value)
    value.to_s.strip.match?(/\A\d{10}\z/)
  end

  def log_bank_name_mismatch!(account_id:, canonical_bank_name:)
    return if account_id.blank? || canonical_bank_name.blank?

    detail_response = fetch_account_detail(account_id, true)
    return unless detail_response[:status] == :ok

    provider_bank_name =
      detail_response.dig(:data, 'attributes', 'bank', 'name').to_s.strip
    return if provider_bank_name.blank? || provider_bank_name.casecmp(canonical_bank_name.to_s.strip).zero?

    Rails.logger.warn(
      {
        event: 'anchor.bank_mismatch',
        account_id: account_id,
        canonical_bank_name: canonical_bank_name,
        provider_bank_name: provider_bank_name
      }.to_json
    )
  rescue StandardError
    nil
  end

  def sanitize_transfer_reason(reason)
    value = reason.to_s.strip
    value = 'Fund Transfer' if value.blank?
    value[0, 100]
  end

  def ngn_to_kobo(amount)
    value = BigDecimal(amount.to_s)
    (value * 100).round(0).to_i
  rescue ArgumentError, TypeError
    0
  end

  def with_anchor_idempotency(headers:, key:)
    return headers if key.to_s.strip.empty?

    headers.merge('x-anchor-idempotent-key' => key.to_s)
  end
  private :with_anchor_idempotency

  def build_anchor_idempotency_key(prefix:, raw:)
    value = raw.to_s.strip.downcase
    value = Digest::SHA256.hexdigest(value) if value.length > 80
    "#{prefix}:#{value}"[0, 100]
  end
  private :build_anchor_idempotency_key

  def resolve_deposit_account_id_by_account_number(account_number)
    number = account_number.to_s.strip
    return nil if number.blank?

    response = self.class.get('/api/v1/account-numbers', headers: @headers)
    return nil unless response.success?

    rows = response['data']
    rows = [rows] unless rows.is_a?(Array)

    match = rows.find do |row|
      attrs = row.is_a?(Hash) ? (row['attributes'] || {}) : {}
      attrs['accountNumber'].to_s.strip == number
    end
    return nil unless match.is_a?(Hash)

    candidate_id = match['id'].to_s
    return candidate_id if candidate_id.end_with?('-anc_acc')

    nil
  rescue StandardError
    nil
  end
end
