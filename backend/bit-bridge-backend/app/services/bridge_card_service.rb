# frozen_string_literal: true

class BridgeCardService
  include HTTParty

  base_uri 'https://issuecards.api.bridgecard.co/v1'

  DEFAULT_CARD_LIMIT = '500000'

  def initialize
    # ✅ Use ENV in real deployments
    @secret_key = ENV['BITBRIDGE_SECRET'].presence || 'BITBRIDGE_SECRET'
    token = ENV['BRIDGE_CARD_TOKEN'].presence || ENV['BRIDGE_TOKEN'].presence

    # ⚠️ fallback (NOT recommended) — keep it only if you’re still testing locally
    token ||= 'PASTE_TEST_TOKEN_HERE_IF_YOU_MUST'

    @headers = {
      'token' => "Bearer #{token}",
      'Content-Type' => 'application/json'
    }
  end

  # -----------------------------
  # CARDHOLDER
  # -----------------------------
  def register_cardholder_synchronously(account_params)
    first_name  = account_params[:first_name]
    last_name   = account_params[:last_name]
    address     = account_params[:address]
    phone       = account_params[:phone_number] || account_params[:phone]
    city        = account_params[:city]
    state_variants = build_state_variants(account_params[:state])
    house_no    = account_params[:house_no]
    postal_code = account_params[:postal_code]
    email       = account_params[:email].presence || account_params[:email_address].presence
    email       ||= account_params[:user_email].presence || account_params[:login].presence
    email       = email.to_s.strip.downcase if email.present?
    bvn         = account_params[:bvn]

    response = nil
    last_error = nil
    selected_state = state_variants.first

    state_variants.each do |candidate_state|
      body = {
        first_name: first_name,
        last_name: last_name,
        address: {
          address: address,
          city: city,
          state: candidate_state,
          country: 'Nigeria',
          postal_code: postal_code,
          house_no: house_no
        },
        phone: phone,
        email_address: email,
        identity: {
          id_type: 'NIGERIAN_BVN_VERIFICATION',
          bvn: bvn,
          selfie_image: 'https://image.com'
        },
        meta_data: { account_source: 'any_value' }
      }.to_json

      begin
        response = fetch('post', '/issuing/sandbox/cardholder/register_cardholder_synchronously', body)
        selected_state = candidate_state
        break
      rescue StandardError => e
        last_error = e
        next if e.message.to_s.match?(/invalid state/i)

        raise
      end
    end

    raise(last_error) if response.blank?

    card_params = {
      first_name: first_name,
      last_name: last_name,
      address: address,
      phone: phone,
      city: city,
      state: selected_state,
      postal: postal_code,
      bvn: bvn,
      house_no: house_no,
      cardholder_id: response.dig('data', 'cardholder_id'),
      user_id: account_params[:user_id]
    }

    card = Card.create!(card_params)
    { data: card, message: response['message'], status: :ok }
  rescue StandardError => e
    { message: e.message, status: :unprocessable_entity }
  end

  # -----------------------------
  # CREATE + FUND CARD (Tunnel-ready)
  # -----------------------------
  #
  # params expected:
  # - :amount (USD funding amount)
  # - :pin
  # - :wallet_type ("usd" or "ngn")
  #
  # NOTE:
  # - If wallet_type == "usd": we debit user's USD wallet (Tunnel) before calling Bridge,
  #   inside an atomic DB transaction, and record a wallet transaction.
  # - If wallet_type != "usd": we keep old legacy behaviour (NO wallet debit) to avoid regressions.
  #
  def create_card(params, card)
  raise ArgumentError, 'Card record is required' if card.blank?

  user = card.user
  raise ArgumentError, 'Card must belong to a user' if user.blank?

  cardholder_id = params[:cardholder_id].presence || card.cardholder_id
  raise ArgumentError, 'cardholder_id is required' if cardholder_id.blank?

  wallet_type = (params[:wallet_type].presence || 'ngn').to_s.downcase

  card_type = (params[:card_type].presence || 'virtual').to_s.downcase
  card_brand = params[:card_brand].presence || 'Mastercard'

  # ✅ enforce USD for tunnel
  card_currency =
    if wallet_type == 'usd'
      'USD'
    else
      (params[:card_currency].presence || 'USD').to_s.upcase
    end

  raw_limit = params[:card_limit].presence || '500000'
  card_limit =
    if wallet_type == 'usd'
      limit_value = BigDecimal(raw_limit.to_s) rescue 0.to_d
      # Bridge expects cents for USD limits.
      limit_value < 100_000 ? (limit_value * 100).to_i : limit_value.to_i
    else
      raw_limit
    end
  transaction_reference = params[:transaction_reference].presence || SecureRandom.uuid

    amount_usd = BigDecimal(params[:amount].to_s) rescue 0.to_d
    amount_cents = (amount_usd * 100).to_i
    pin = params[:pin].to_s

  if wallet_type == 'usd'
    usd_wallet = user.usd_wallet
    raise StandardError, 'USD wallet not found. Activate tunnel first.' if usd_wallet.blank?

    return { message: 'Funding amount must be greater than 0', status: :unprocessable_entity } if amount_usd <= 0

    cents = usd_wallet.money_to_cents(amount_usd)

    ActiveRecord::Base.transaction do
      # 1) record wallet transaction (for timeline/history) before debit
      usd_wallet.transactions.create!(
        transaction_type: 'withdrawal',
        status: 'approved',
        amount: amount_usd,
        coin_type: 'bank',
        address: 'Virtual Card Funding (USD)',
        unique_transaction_id: transaction_reference
      )

      # 2) debit USD wallet stored cents
      usd_wallet.debit_cents!(cents)

      # 3) call Bridge
      body = {
        cardholder_id: cardholder_id,
        card_type: card_type,
        card_brand: card_brand,
        card_currency: card_currency,
        card_limit: card_limit,
        transaction_reference: transaction_reference,
        funding_amount: amount_cents,
        pin: pin,
        meta_data: { account_source: 'any_value' }
      }.to_json

      response = fetch('post', '/issuing/sandbox/cards/create_card', body)

      # 4) persist locally
      card.update!(
        cardholder_id: cardholder_id,
        card_type: card_type,
        card_brand: card_brand,
        card_currency: card_currency,
        card_limit: card_limit,
        transaction_reference: transaction_reference,
        amount: amount_usd,
        pin: pin,
        card_id: response.dig('data', 'card_id') || card.card_id
      )

      return { data: card, message: response['message'], status: :ok }
    end
  end

  # ✅ legacy behaviour (ngn/usdt): do NOT debit wallet here (avoid regressions)
  body = {
    cardholder_id: cardholder_id,
    card_type: card_type,
    card_brand: card_brand,
    card_currency: card_currency,
    card_limit: card_limit,
    transaction_reference: transaction_reference,
    funding_amount: amount_cents,
    pin: pin,
    meta_data: { account_source: 'any_value' }
  }.to_json

  response = fetch('post', '/issuing/sandbox/cards/create_card', body)

  card.update!(
    cardholder_id: cardholder_id,
    card_type: card_type,
    card_brand: card_brand,
    card_currency: card_currency,
    card_limit: card_limit,
    transaction_reference: transaction_reference,
    amount: amount_usd,
    pin: pin,
    card_id: response.dig('data', 'card_id') || card.card_id
  )

  { data: card, message: response['message'], status: :ok }
rescue StandardError => e
  { message: e.message, status: :unprocessable_entity }
end


  # -----------------------------
  # CARD DETAILS / BALANCE
  # -----------------------------
  def get_all_states(params = {})
    country =
      params[:country].presence ||
      params[:country_code].presence ||
      params[:country_name].presence ||
      'NG'

    attempts = []
    attempts << { country: country } if country.present?
    attempts << { country_name: 'Nigeria' }
    attempts << { country_code: 'NG' }
    attempts << nil

    response = nil
    data = nil

    attempts.each do |query_params|
      url =
        if query_params.present?
          "/issuing/sandbox/cardholder/get_all_states?#{query_params.to_query}"
        else
          '/issuing/sandbox/cardholder/get_all_states'
        end

      response = fetch('get', url, nil)
      data = response['data']
      break if data.present?
    end

    states =
      if data.is_a?(Hash)
        data['states'] || data['state_list'] || data['items'] || data['data'] || data
      else
        data
      end

    if defined?(Rails) && Rails.logger
      count = states.is_a?(Array) ? states.size : states.present? ? 1 : 0
      Rails.logger.info("[BridgeCardService] get_all_states country=#{country} count=#{count}")
    end

    { data: states, status: :ok }
  rescue StandardError => e
    if defined?(Rails) && Rails.logger
      Rails.logger.warn("[BridgeCardService] create_card failed message=#{e.message}")
    end
    { message: e.message, status: :unprocessable_entity }
  end

  def card_details(card_id)
    raise ArgumentError, 'card_id is required' if card_id.blank?
    url = "/issuing/sandbox/cards/get_card_details?card_id=#{card_id}"
    response = fetch('get', url, nil)
    { data: response['data'], status: :ok }
  rescue StandardError => e
    { message: e.message, status: :unprocessable_entity }
  end

  def card_details_reveal(card_id)
    raise ArgumentError, 'card_id is required' if card_id.blank?

    base = 'https://issuecards-api-bridgecard-co.relay.evervault.com/v1'
    path = if Rails.env.production?
             "/issuing/cards/get_card_details?card_id=#{card_id}"
           else
             "/issuing/sandbox/cards/get_card_details?card_id=#{card_id}"
           end

    response = self.class.get("#{base}#{path}", headers: @headers)
    parsed = response.respond_to?(:parsed_response) ? response.parsed_response : response
    { data: parsed['data'], status: :ok }
  rescue StandardError => e
    { message: e.message, status: :unprocessable_entity }
  end

  def card_balance(card_id)
    raise ArgumentError, 'card_id is required' if card_id.blank?
    url = "/issuing/sandbox/cards/get_card_balance?card_id=#{card_id}"
    response = fetch('get', url, nil)
    { data: response['data'], status: :ok }
  rescue StandardError => e
    { message: e.message, status: :unprocessable_entity }
  end

  def freeze_card(card_id)
    raise ArgumentError, 'card_id is required' if card_id.blank?
    url =
      if Rails.env.production?
        "/issuing/cards/freeze_card?card_id=#{card_id}"
      else
        "/issuing/sandbox/cards/freeze_card?card_id=#{card_id}"
      end
    response = fetch('patch', url, nil)
    { data: response['data'], message: response['message'], status: :ok }
  rescue StandardError => e
    { message: e.message, status: :unprocessable_entity }
  end

  def unfreeze_card(card_id)
    raise ArgumentError, 'card_id is required' if card_id.blank?
    url =
      if Rails.env.production?
        "/issuing/cards/unfreeze_card?card_id=#{card_id}"
      else
        "/issuing/sandbox/cards/unfreeze_card?card_id=#{card_id}"
      end
    response = fetch('patch', url, nil)
    { data: response['data'], message: response['message'], status: :ok }
  rescue StandardError => e
    { message: e.message, status: :unprocessable_entity }
  end

  # -----------------------------
  # FUND ISSUING WALLET (Bridge side)
  # -----------------------------
  def fund_wallet(card_params)
    amount = card_params[:amount] || card_params['amount']
    currency = (card_params[:currency] || card_params['currency'] || 'USD').to_s.upcase

    body = { amount: amount }.to_json
    url = "/issuing/sandbox/cards/fund_issuing_wallet?currency=#{currency}"

    response = fetch('patch', url, body)
    { data: response['data'], message: response['message'], status: :ok }
  rescue StandardError => e
    { message: e.message, status: :unprocessable_entity }
  end

  private
  def normalize_state(value)
    raw = value.to_s.strip
    return raw if raw.blank?

    # Drop parenthetical suffixes e.g. "Federal Capital Territory (Abuja)"
    cleaned = raw.gsub(/\s*\(.*\)\s*/, '').strip

    return 'Federal Capital Territory' if cleaned.match?(/\bfct\b/i)
    return 'Federal Capital Territory' if cleaned.match?(/federal capital territory/i)

    cleaned
  end

  def build_state_variants(value)
    raw = value.to_s.strip
    normalized = normalize_state(raw)

    variants = [raw, normalized].compact.map(&:strip).reject(&:blank?)

    if normalized.match?(/\bfct\b/i) || normalized.match?(/federal capital territory/i)
      variants.concat([
        'Federal Capital Territory',
        'Abuja',
        'FCT',
        'Federal Capital Territory (Abuja)'
      ])
    else
      variants << "#{normalized} State" unless normalized.blank? || normalized.match?(/\bstate\b/i)
    end

    variants.map(&:strip).reject(&:blank?).uniq
  end


  def bridge_create_card!(cardholder_id:, card_type:, card_brand:, card_currency:, card_limit:, transaction_reference:, funding_amount:, pin:)
    body = {
      cardholder_id: cardholder_id,
      card_type: card_type,
      card_brand: card_brand,
      card_currency: card_currency,
      card_limit: card_limit,
      transaction_reference: transaction_reference,
      funding_amount: funding_amount.to_s,
      pin: pin,
      meta_data: { account_source: 'any_value' }
    }.to_json

    fetch('post', '/issuing/sandbox/cards/create_card', body)
  end

  def fetch(method, url, body)
    response =
      case method
      when 'get'
        self.class.get(url, headers: @headers)
      when 'post'
        self.class.post(url, body: body, headers: @headers)
      when 'patch'
        self.class.patch(url, body: body, headers: @headers)
      else
        raise "Unsupported method: #{method}"
      end

    return response if response.success?

    if defined?(Rails) && Rails.logger
      Rails.logger.warn(
        "[BridgeCardService] request failed status=#{response.code} body=#{response.parsed_response.inspect}"
      )
    end

    raise response.dig('detail', 0, 'msg') || response['message'] || 'Bridge request failed'
  rescue StandardError => e
    if defined?(Rails) && Rails.logger
      Rails.logger.warn("[BridgeCardService] exception=#{e.class} message=#{e.message}")
    end
    raise(e.message.presence || 'Bridge request failed')
  end

  # ---------- money helpers ----------
  def to_decimal(v)
    BigDecimal(v.to_s)
  rescue
    0.to_d
  end

  def money_to_cents(wallet, amount)
    if wallet.respond_to?(:money_to_cents)
      wallet.money_to_cents(amount)
    else
      # assume 2dp currency
      (amount.to_d * 100).to_i
    end
  end

  def wallet_balance_cents(wallet)
    if wallet.respond_to?(:balance_cents)
      wallet.balance_cents.to_i
    else
      # fallback if you store balance as a decimal column
      money_to_cents(wallet, wallet.balance.to_d)
    end
  end

  def debit_wallet_cents!(wallet, cents)
    if wallet.respond_to?(:debit_cents!)
      wallet.debit_cents!(cents)
    elsif wallet.respond_to?(:balance_cents)
      wallet.update!(balance_cents: wallet.balance_cents.to_i - cents.to_i)
    else
      # decimal fallback
      new_balance = wallet.balance.to_d - (cents.to_d / 100)
      wallet.update!(balance: new_balance)
    end
  end
end
