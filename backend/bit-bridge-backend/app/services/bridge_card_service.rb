# frozen_string_literal: true

# require 'aes_everywhere'
class BridgeCardService
  include HTTParty

  base_uri 'https://issuecards.api.bridgecard.co/v1/'

  def initialize
    # @secret_key = ENV['BITBRIDGE_SECRET']
    # token = ENV['BRIDGE_CARD_TOKEN']

    @secret_key = 'BITBRIDGE_SECRET'
    token = 'at_test_fe591f230a9b7f4f7c5f6bef43846ab4f94f211e6ee679d93879a9b1c6763fe1c2995e38900db8c07ac7bc6dfa58df44efc9fb808f43ca6881e2741044f43e9dc4676cea48f96f5a0931884b4d7a52f5260c3814d2339cdddc9b280e499c87872747e9abceab6d506529cce8d10440edc53ee88876904ee7271d6b856858c501e31fa9929c86e761b67c9239094f08b32e1aaf40d914515c2506fa8b5e5237920bf23235de90283a98ececd70b435585870f62f34f06ee37f6f5794361b23b3513aa8efff5fdd2e33cc88a375374053552c90a89b6edc6c711e8714a495a1cbe09038d6fe5f340d6840dd46336dc4dd708b871ff401afec416d0b8521c3162ac'
    @headers = {
      'token' => "Bearer #{token}",
      'Content-Type' => 'application/json'
    }
  end

  def register_cardholder_synchronously(account_params)
    first_name = account_params[:first_name]
    last_name = account_params[:last_name]
    address = account_params[:address]
    phone = account_params[:phone_number]
    city = account_params[:city]
    state = account_params[:state]
    house_no = account_params[:house_no]
    postal_code = account_params[:postal_code]
    email =  account_params[:email]
    bvn = account_params[:bvn]


    # card_params = {
    #   first_name: first_name,
    #   last_name: last_name,
    #   address: address,
    #   phone: phone,
    #   city: city,
    #   state: state,
    #   postal_code: postal_code,
    #   bvn: bvn,
    #   house_no: house_no,
    #   user_id: account_params[:user_id]


    # }

    begin
      body = {
        'first_name' => first_name,
        'last_name' => last_name,
        "address": {
          'address' => address,
          'city' => city,
          'state' => state,
          'country' => 'Nigeria',
          'postal_code' => postal_code,
          'house_no' => house_no
        },
        'phone' => phone,
        'email_address' => email,
        "identity": {
          "id_type": 'NIGERIAN_BVN_VERIFICATION',
          "bvn": bvn,
          "selfie_image": 'https://image.com'
        },
        "meta_data": { "account_source": 'any_value' }

      }.to_json
      url = '/issuing/sandbox/cardholder/register_cardholder_synchronously'
      response = fetch('post', url, body)


      card_params = {
        first_name: first_name,
        last_name: last_name,
        address: address,
        phone: phone,
        city: city,
        state: state,
        postal: postal_code,
        bvn: bvn,
        house_no: house_no,
        cardholder_id: response['data']['cardholder_id'],
        user_id: account_params[:user_id]


      }

      card = Card.create!(card_params)

      { data: card, message: response['message'], status: :ok }
    rescue StandardError => e
      { message: e.message, status: :bad_request }
    end
  end

  def create_card(params, card)
    cardholder_id = params[:cardholder_id]
    card_type = params[:card_type].downcase || 'virtual' # "virtual" or "physical"
    card_brand = params[:card_brand] || 'Mastercard'
    card_currency = params[:card_currency] || 'USD'

    card_limit = params[:card_limit] || '500000'
    transaction_reference = params[:transaction_reference] || SecureRandom.uuid
    amount = params[:amount] || '0'


    # pin = AES256.encrypt(params[:pin], @secret_key)
    pin = params[:pin]
    # meta_data = params[:meta_data] || {}


    card_params = {
      cardholder_id: cardholder_id,
      card_type: card_type,
      card_brand: card_brand,
      card_currency: card_currency,
      card_limit: card_limit,
      transaction_reference: transaction_reference,
      amount: amount,
      pin: pin
    }
    begin
      body = {
        'cardholder_id' => cardholder_id,
        'card_type' => card_type,
        'card_brand' => card_brand,
        'card_currency' => card_currency,
        'card_limit' => card_limit,
        'transaction_reference' => transaction_reference,
        'funding_amount' => amount,
        'pin' => pin,
        "meta_data": { "account_source": 'any_value' }
      }.to_json


      response = fetch('post', '/issuing/sandbox/cards/create_card', body)

      card.update!(card_params)

      { data: card, message: response['message'], status: :ok }
      # handle_response(response)
    rescue StandardError => e
      { success: false, message: e.message, status: :bad_request }
    end
  end

  # Fetch card details by card_id
  def card_details(card_id)
    raise ArgumentError, 'card_id is required' if card_id.blank?

    url = "/issuing/sandbox/cards/get_card_details?card_id=#{card_id}"

    response = fetch('get', url, body)
    { data: response['data'], status: :ok }
  rescue StandardError => e
    { success: false, message: e.message, status: bad_request }
  end

  # card balance
  def card_balance(card_id)
    raise ArgumentError, 'card_id is required' if card_id.blank?

    url = "/issuing/sandbox/cards/get_card_balance?card_id=#{card_id}"

    response = fetch('get', url, nil)
    { data: response['data'], status: :ok }
  rescue StandardError => e
    { success: false, message: e.message, status: bad_request }
  end

  def create_virtua_card(pin)
    encryped_pin = AES256.encrypt(pin, @secret_key)
    AES256.decrypt(encryped_pin, @secret_key)
    bitbridge_key
    cardholder_id = 'd0658fedf8284207866d96183fa'
    card_type = 'virtual' || 'physical'
    card_limit = '500000' || '1000000'
    reference = '',
                amount = '300'
    user_id = 'd0658fedf828420786e4a7083fa'


    body = {
      cardholder_id: cardholder_id,
      card_type: card_type,
      card_brand: 'Mastercard',
      card_currency: 'USD',
      card_limit: card_limit,
      transaction_reference: reference,
      funding_amount: amount,
      pin: encryped_pin,
      meta_data: { user_id: user_id }

    }.to_json

    url = '/issuing/sandbox/cards/create_card'

    fetch('post', url, body)
  rescue StandardError => e
    { message: e.message, status: :bad_request }
  end

  def fund_wallet(card_params)
    amount = card_params['amount']
    currency = card_params['currency'] || 'USD'
    body = {
      amount: amount
    }.to_json

    url = "/issuing/sandbox/cards/fund_issuing_wallet?currency=#{currency}"


    response = fetch('patch', url, body)

    { data: response['data'], message: response['message'], status: :ok }
  rescue StandardError => e
    { message: e.message, status: :bad_request }
  end

  def fund_card(_card_params)
    cardholder_id = 'd0658fedf8284207866d96183fa'
    amount = ''
    reference = ''

    body = {
      card_id: cardholder_id,
      amount: amount,
      transaction_reference: reference,
      currency: 'USD'

    }.to_json

    url = '/issuing/sandbox/cards/fund_card_asynchronously'

    fetch('patch', url, body)
    { data: response['data'], status: :ok }
  rescue StandardError => e
    { message: e.message, status: :bad_request }
  end



  private

  def fetch(_method, _url, body)
    response = ''
    case _method
    when 'get'

      response = self.class.get(_url, headers: @headers)
    when 'post'

      response = self.class.post(_url,
                                 body: body, headers: @headers)
    when 'patch'

      response = self.class.patch(_url,
                                  body: body, headers: @headers)

    else
      raise 'No method pased'

    end

    return response if response.success?

    raise response.dig('detail', 0, 'msg') || response['message'] || 'failed to created card'
  rescue StandardError => e
    raise e.message || 'something went wrong'
  end
end
