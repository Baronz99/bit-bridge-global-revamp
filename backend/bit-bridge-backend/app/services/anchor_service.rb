# frozen_string_literal: true

class AnchorService
  include HTTParty

  base_uri ENV['DEV_ANCHOR_BASE_URL'] || 'https://api.sandbox.getanchor.co/'
  def initialize
    header_api_key = ENV['DEV_ANCHOR_API_KEY'] || '9P6wC.4aed16aee26886c2480fbe21d174d2a1973dddaa3d3cac7d5b8908b4e24999d841b8491ff77c8f6a6d9a278483363a2312aa'

    @headers = {
      'x-anchor-key' => header_api_key,
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
    phone_number = user_data[:phone_number]
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
        error_title = response.dig('errors', 0, 'detail') || 'bad request'
        raise error_title
      end
    rescue StandardError => e
      { message: e.message || 'bad request', status: :bad_request }
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

      raise response&.dig('errors', 0, 'detail') || 'bad request' unless response.success?

      message = response&.dig('data', 'attributes', 'message')
      raise 'account  not found' unless account
      unless account.update(status: 'verifying', dob: dob, bvn: bvn, gender: gender)
        raise account.errors.full_messages.to_sentence || 'bad request'
      end

      # return {response: response["data"], message: message, status: :ok}
      { response: account, message: message, status: :ok }
    rescue StandardError => e
      { message: e.message || 'bad request', status: :bad_request }
    end
  end

  def create_account_number(type = :individual, account)
    productType = 'SAVINGS'

    current_user = account[:account]

    id = account[:account][:account_id]
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


      bank_name = response.dig('data', 'attributes', 'bank', 'name')
      useable_id = response.dig('data', 'id')
      account_number = response.dig('data', 'attributes', 'accountNumber')
      account_name = response.dig('data', 'attributes', 'accountName')


      raise response.dig('errors', 0, 'detail') || 'bad request' unless response.success?

      unless current_user.update(account_number: account_number, account_type: type, status: 'completed',
                                 active: true, bank_name: bank_name, account_name: account_name, useable_id: useable_id)

        current_user.errors.full_messages.to_sentence || 'bad request'
      end

      #  return   {response: response["data"], status: :ok}
      { response: current_user, status: :ok }
    rescue StandardError => e
      { response: e.message.to_s, message: e.message || 'bad request', status: :bad_request }
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
    response = self.class.get("/payments/verify-account/#{bank_id}/#{account_number} ", headers: @headers)


    raise response['message'] || 'bad request' unless response.success?

    { data: response, status: :ok }
  rescue StandardError => e
    { message: e.message.to_s || 'bad request', status: :bad_request }
  end

  def create_counter_party(transfer_params)
    account_name = transfer_params['account_name'].present? ? transfer_params['account_name'] : 'nil'
    body = {
      data: {
        type: 'CounterParty',
        attributes: {
          bankCode: transfer_params['bank_code'],
          accountNumber: transfer_params['account_number'],
          verifyName: true
        }
      }
    }

    # Add accountName only if present
    # body[:data][:attributes][:accountName] = transfer_params['account_name'] if transfer_params['account_name'].present?
    body[:data][:attributes][:accountName] = account_name
    body = body.to_json

    begin
      fetch('post', 'counterparties', nil, body)
    rescue StandardError => e
      { message: e.message.to_s || 'bad request', status: :bad_request }
    end
  end

  def get_inbound_transfer(transfer_id)
    response = self.class.get("api/v1/inbound-transfers/#{transfer_id}", headers: @headers)

    raise response['message'] || 'bad request' unless response.success?

    receipient_id = response&.dig('relationships', 'account', 'data', 'id')
    amount = response&.dig('attributes', 'amount')
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
      coin_type: 'bank'
    }


    transaction = Transaction.new(transaction_params)
    raise transaction.errors.full_messages.to_sentence unless transaction.persisted?
  rescue StandardError => e
    puts e.message
  end

  def initiate_transfer(transfer_params)
    transfer_type = transfer_params[:inter_bank] ? 'BookTransfer' : 'NIPTransfer'
    recipient_name = transfer_params[:account_name]
    account_number = transfer_params[:account_number]
    source_name = transfer_params[:source_name]
    source_account_number = transfer_params[:source_account_number]
    initials = recipient_name.to_s.strip.split(' ').map { |name| name[0] }.join.downcase
    reference = "fbg#{Time.now.to_i}#{initials}"
    counter_party_id = transfer_params[:counter_party_id]
    counter_party_id_type = 'CounterParty'
    bank_code = transfer_params[:bank_code]
    bank = 'anchor'
    recipient_bank = transfer_params['bank']
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
          amount: transfer_params[:amount],
          currency: 'NGN',
          reason: transfer_params[:description].blank? ? 'Fund Transfer' : transfer_params[:description],
          reference: reference
        },
        relationships: relationships
      }
    }.to_json


    begin
      # Remove trailing space in URL and make POST request
      response = fetch('post', 'transfers', nil, body)

      # Use dig to safely access nested JSON keys
      transfer_id = response.dig(:data, 'id')
      status       = response.dig(:data, 'attributes', 'status')&.downcase
      amount       = response.dig(:data, 'attributes', 'amount')
      description  = response.dig(:data, 'attributes', 'reason')

      # Example: create a transaction record (assuming `transaction` is a model)
      transaction = Transaction.new(
        wallet_id: transfer_params[:wallet_id],
        account_id: transfer_params[:account_id],
        status: status,
        amount: amount,
        account_name: source_name,
        address: source_account_number,
        transaction_type: 'withdrawal',
        unique_transaction_id: counter_party_id,
        bank: bank,
        transfer_id: transfer_id
      )

      raise transaction.errors.full_messages.to_sentence unless transaction.valid?

      transaction.save!
      transaction.create_transaction_record!(
        status: status,
        description: description,
        customer_name: recipient_name,
        reference: reference,
        account_number: account_number,
        bank_code: bank_code,
        bank: recipient_bank,
        amount: amount
      )

      { data: transaction, status: :ok }
    rescue StandardError => e
      { message: e.message.presence || 'Bad request', status: :bad_request }
    end
  end

  def verify_transfer_request(transferId)
    response = self.class.get("/verify/#{transferId}", headers: @headers)
    return { data: response['data'], status: :ok } if response.success?

    raise response['message'] || 'bad request'
  rescue StandardError => e
    { message: e.message.to_s || 'bad request', status: :bad_request }
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

    query = view_account ? "?#{{ include: 'AccountNumber' }.to_query} " : ''
    fetch('get', base_url, query, nil)
  rescue StandardError => e
    { message: e.message.to_s || 'bad request', status: :bad_request }
  end

  def fund_deposit_account(data)
    account_id = data.dig('attributes', 'payment', 'settlementAccount', 'accountId')

    Rails.logger.info("✅  Anchor webhook userId: ======================== #{account_id} ")

    account = Account.find_by(useable_id: account_id)



    Rails.logger.info("❌ Anchor account  does not exist ======================== #{account}") unless account

    amount = data['attributes']['payment']['amount']
    receiver_account_number = data.dig('attributes', 'payment', 'virtualNuban', 'accountNumber') || 'N/A'
    receiver_account_name = data.dig('attributes', 'payment', 'virtualNuban', 'accountName') || 'N/A'
    bank = 'Anchor'
    bank_code = 'anchor'
    status =  'approved'
    description = data.dig('attributes', 'payment', 'narration')
    sender_account_number = data.dig('attributes', 'payment', 'counterParty', 'accountNumber')
    sender_name = data.dig('attributes', 'payment', 'counterParty', 'accountName')
    sender_bank = data.dig('attributes', 'payment', 'counterParty', 'bank', 'name')
    reference =   data.dig('attributes', 'payment', 'paymentReference')


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
      coin_type: 'bank'
    }


    transaction = Transaction.new(transaction_params)

    raise transaction.errors.full_messages.to_sentence unless transaction.save

    Rails.logger.info("✅ Transaction saved successfully #{transaction.id}")





    transaction.create_transaction_record!(
      status: status,
      description: description,
      customer_name: receiver_account_name,
      reference: reference,
      account_number: receiver_account_number,
      bank_code: bank_code,
      bank: bank,
      amount: amount
    )
  rescue StandardError => e
    puts e.message
  end

  def confirm_transfer_withdrawal(data)
    transfer_id = data.dig('relationships', 'transfer', 'data', 'id')

    raise 'Missing transfer ID in webhook payload' unless transfer_id

    transaction =  Transaction.find_by(transfer_id: transfer_id)
    raise "Transaction not found for transfer ID: #{transfer_id}" unless transaction


    if transaction.update(status: 'approved')
      Rails.logger.info("✅ Transaction #{transaction.id} (Transfer #{transfer_id}) approved successfully.")

    else
      error_message = transaction.errors.full_messages.to_sentence
      Rails.logger.error("❌ Failed to approve transaction #{transaction.id}: #{error_message}")

    end
  end


  private

  def store_account_details(account_id, user_data)
    new_account = Account.create(user_id: user_data[:user_id], postal_code: user_data[:postal_code],
                                 bvn: user_data[:bvn], city: user_data[:city], state: user_data[:state], dob: user_data[:dob], address: user_data[:address], account_id: account_id, vendor: user_data[:vendor])

    raise new_account.errors.full_messages.to_sentence unless new_account.persisted?

    new_account
  end

  def fetch(method, api, params = '', body = nil)
    response =
      case method.downcase
      when 'get'
        self.class.get("/api/v1/#{api}#{params}", headers: @headers, body: body)
      when 'post'
        self.class.post("/api/v1/#{api}#{params}", headers: @headers, body: body)
      else
        raise StandardError, 'Unsupported HTTP method'
      end

    if response.success?
      { data: response['data'], status: :ok }
    else
      error_message = response.dig('errors', 0, 'detail') || response.message || 'Bad request'
      raise StandardError, error_message
    end
  rescue StandardError => e
    raise StandardError, e.message
  end
end
