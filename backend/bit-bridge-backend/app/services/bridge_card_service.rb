# frozen_string_literal: true
require 'aes-everywhere'

class BridgeCardService
  include HTTParty

  base_uri 'https://issuecards.api.bridgecard.co/v1'

  DEFAULT_CARD_LIMIT = '500000'
  CARD_CREATION_FEE_USD = 4
  CARD_ACTIVATION_MIN_USD = 5
  CARD_MIN_FUNDING_USD_BY_LIMIT = {
    500_000 => 3,
    1_000_000 => 4
  }.freeze

  def initialize
    @headers = nil
  end


  # -----------------------------
  # CARDHOLDER
  # -----------------------------
  def register_cardholder(account_params, mode: :async)
    registration_mode = mode.to_s.downcase == 'sync' ? :sync : :async
    normalized = {}

    normalized = normalize_cardholder_params(account_params)
    request_id = sanitize_text(account_params[:request_id])
    log_cardholder_context(
      stage: 'normalize',
      request_id: request_id,
      mode: registration_mode,
      normalized: normalized
    )
    validate_cardholder_required!(normalized, mode: registration_mode)

    response = nil
    last_error = nil
    selected_state = normalized[:state_variants].first

    normalized[:state_variants].each do |candidate_state|
      payload = build_cardholder_payload(normalized.merge(selected_state: candidate_state))
      body = payload.to_json
      endpoint =
        registration_mode == :sync ?
          issuing_endpoint('cardholder/register_cardholder_synchronously') :
          issuing_endpoint('cardholder/register_cardholder')

      log_cardholder_context(
        stage: 'provider_request',
        request_id: request_id,
        mode: registration_mode,
        normalized: normalized,
        endpoint: endpoint,
        candidate_state: candidate_state,
        payload: payload
      )

      begin
        response = fetch('post', endpoint, body)
        log_cardholder_context(
          stage: 'provider_response_ok',
          request_id: request_id,
          mode: registration_mode,
          normalized: normalized,
          endpoint: endpoint,
          candidate_state: candidate_state,
          response: response
        )
        selected_state = candidate_state
        break
      rescue StandardError => e
        last_error = e
        log_cardholder_context(
          stage: 'provider_response_error',
          request_id: request_id,
          mode: registration_mode,
          normalized: normalized,
          endpoint: endpoint,
          candidate_state: candidate_state,
          error: e
        )
        next if e.message.to_s.match?(/invalid state/i)

        raise
      end
    end

    raise(last_error) if response.blank?

    cardholder_id = response.dig('data', 'cardholder_id')
    card = upsert_cardholder_record!(
      normalized: normalized,
      selected_state: selected_state,
      cardholder_id: cardholder_id,
      mode: registration_mode
    )

    { data: card, message: response['message'], status: :ok }
  rescue StandardError => e
    log_cardholder_context(
      stage: 'register_cardholder_failed',
      request_id: sanitize_text(account_params[:request_id]),
      mode: registration_mode,
      normalized: normalized,
      error: e
    )
    { message: e.message, status: :unprocessable_entity }
  end

  def register_cardholder_synchronously(account_params)
    register_cardholder(account_params, mode: :sync)
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
  card_limit_cents = normalize_card_limit_cents(raw_limit)
  card_limit = wallet_type == 'usd' ? card_limit_cents : raw_limit
  transaction_reference = params[:transaction_reference].presence || SecureRandom.uuid

  amount_usd = BigDecimal(params[:amount].to_s) rescue 0.to_d
  amount_cents = (amount_usd * 100).to_i
  encrypted_pin = encrypt_pin_for_bridge(params[:pin])

  if wallet_type == 'usd'
    usd_wallet = user.usd_wallet
    raise StandardError, 'USD wallet not found. Activate tunnel first.' if usd_wallet.blank?

    return { message: 'Funding amount must be 0 or more', status: :unprocessable_entity } if amount_usd.negative?

    setting = FxSetting.current
    fee_cents = setting.card_creation_fee_usd_cents.to_i
    fee_cents = (CARD_CREATION_FEE_USD * 100).to_i if fee_cents <= 0
    min_funding_cents = minimum_funding_cents_for_limit(card_limit_cents)
    meta = card.meta_data.is_a?(Hash) ? card.meta_data.dup : {}
    fee_charged = meta['creation_fee_charged'] == true
    requires_funding = amount_cents >= min_funding_cents

    required_cents = 0
    required_cents += fee_cents unless fee_charged
    required_cents += amount_cents if requires_funding

    if required_cents.positive? && wallet_balance_cents(usd_wallet) < required_cents
      return {
        message: 'Insufficient Tunnel balance to cover the card creation fee and funding.',
        status: :unprocessable_entity
      }
    end

    cents = usd_wallet.money_to_cents(amount_usd)

    ActiveRecord::Base.transaction do
      fee_txn = nil
      if !fee_charged
        fee_reference = "card-fee-#{SecureRandom.uuid}"

        fee_amount_usd = (fee_cents / 100.0).round(2)
        fee_txn = usd_wallet.transactions.create!(
          transaction_type: 'withdrawal',
          status: 'approved',
          amount: fee_amount_usd,
          coin_type: 'bank',
          address: 'Virtual Card Creation Fee',
          unique_transaction_id: fee_reference
        )

        usd_wallet.debit_cents!(fee_cents)

        meta['creation_fee_charged'] = true
        meta['creation_fee_cents'] = fee_cents
        meta['creation_fee_reference'] = fee_reference
        meta['creation_fee_charged_at'] = Time.current
      end

      unless requires_funding
        card.update!(
          meta_data: meta,
          status: 'pending_funding'
        )
        return {
          data: card,
          message: "Card created. Fund at least USD #{(min_funding_cents / 100.0).to_i} to activate.",
          status: :ok
        }
      end

      # 1) record wallet transaction (for timeline/history) before debit
      fund_txn = usd_wallet.transactions.create!(
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
        pin: encrypted_pin,
        meta_data: build_card_create_metadata(
          user: user,
          card: card,
          wallet_type: wallet_type,
          transaction_reference: transaction_reference
        )
      }.to_json

      response = fetch('post', issuing_endpoint('cards/create_card'), body)

      # 4) persist locally
      new_card_id = response.dig('data', 'card_id') || card.card_id

     card.update!(
  cardholder_id: cardholder_id,
  card_type: card_type,
  card_brand: card_brand,
  card_currency: card_currency,
  card_limit: card_limit,
  transaction_reference: transaction_reference,
  amount: amount_usd,
  card_id: new_card_id,
  status: 'active',
  meta_data: meta
)


      fee_txn&.update!(bridge_card_id: new_card_id)
      fund_txn&.update!(bridge_card_id: new_card_id)

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
    pin: encrypted_pin,
    meta_data: build_card_create_metadata(
      user: user,
      card: card,
      wallet_type: wallet_type,
      transaction_reference: transaction_reference
    )
  }.to_json

  response = fetch('post', issuing_endpoint('cards/create_card'), body)

  card.update!(
  cardholder_id: cardholder_id,
  card_type: card_type,
  card_brand: card_brand,
  card_currency: card_currency,
  card_limit: card_limit,
  transaction_reference: transaction_reference,
  amount: amount_usd,
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
          "#{issuing_endpoint('cardholder/get_all_states')}?#{query_params.to_query}"
        else
          issuing_endpoint('cardholder/get_all_states')
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
    path =
      if Bridgecard::Config.live?
        "/issuing/cards/get_card_details?card_id=#{CGI.escape(card_id.to_s)}"
      else
        "/issuing/sandbox/cards/get_card_details?card_id=#{CGI.escape(card_id.to_s)}"
      end
    response = fetch('get', path, nil)
    { data: response['data'], status: :ok }
  rescue StandardError => e
    { message: e.message, status: :unprocessable_entity }
  end

  def card_details_reveal(card_id)
  raise ArgumentError, 'card_id is required' if card_id.blank?

  base = 'https://issuecards-api-bridgecard-co.relay.evervault.com/v1'

  # Prefer explicit config instead of Rails.env so local/dev can use live if needed
  sandbox =
    if ENV.key?('BRIDGE_CARDS_SANDBOX')
      %w[true 1 yes].include?(ENV['BRIDGE_CARDS_SANDBOX'].to_s.downcase)
    else
      !Rails.env.production?
    end

  path =
    if sandbox
      "/issuing/sandbox/cards/get_card_details?card_id=#{CGI.escape(card_id.to_s)}"
    else
      "/issuing/cards/get_card_details?card_id=#{CGI.escape(card_id.to_s)}"
    end

  response = self.class.get("#{base}#{path}", headers: headers)

  # HTTP-level failure
  http_code = response.respond_to?(:code) ? response.code.to_i : nil
  parsed =
    if response.respond_to?(:parsed_response)
      response.parsed_response
    else
      response
    end

  # Normalize parsed into a hash
  parsed = {} unless parsed.is_a?(Hash)

  # Bridge can fail via status codes OR via body fields
  body_error =
    parsed['error'] ||
    parsed['message'] ||
    parsed.dig('data', 'error') ||
    parsed.dig('data', 'message')

  data = parsed['data']

  if (http_code && http_code >= 400) || data.blank?
    # Return a meaningful message for frontend/debugging without leaking secrets
    msg = body_error.presence || "Reveal failed (#{http_code || 'unknown'})."
    return { message: msg, status: :unprocessable_entity, raw: parsed }
  end

  { data: data, status: :ok }
rescue StandardError => e
  { message: e.message, status: :unprocessable_entity }
end


  def card_balance(card_id)
    raise ArgumentError, 'card_id is required' if card_id.blank?
    path =
      if Bridgecard::Config.live?
        "/issuing/cards/get_card_balance?card_id=#{CGI.escape(card_id.to_s)}"
      else
        "/issuing/sandbox/cards/get_card_balance?card_id=#{CGI.escape(card_id.to_s)}"
      end
    response = fetch('get', path, nil)
    { data: response['data'], status: :ok }
  rescue StandardError => e
    { message: e.message, status: :unprocessable_entity }
  end

  def get_card_transactions(card_id:, page: 1, count: 20)
    raise ArgumentError, 'card_id is required' if card_id.blank?

    path =
      if Bridgecard::Config.live?
        '/issuing/cards/get_card_transactions'
      else
        '/issuing/sandbox/cards/get_card_transactions'
      end

    url = "#{path}?card_id=#{CGI.escape(card_id.to_s)}&page=#{page}&count=#{count}"
    response = fetch('get', url, nil)

    { data: response['data'], status: :ok }
  rescue StandardError => e
    { message: e.message, status: :unprocessable_entity }
  end

  def list_card_transactions(card_id:, page: 1, count: 20)
    get_card_transactions(card_id: card_id, page: page, count: count)
  end

  def get_card_transaction_by_id(card_id:, reference: nil, client_transaction_reference: nil)
    raise ArgumentError, 'card_id is required' if card_id.blank?
    reference ||= client_transaction_reference
    raise ArgumentError, 'reference is required' if reference.blank?

    path =
      if Bridgecard::Config.live?
        '/issuing/cards/get_card_transaction_by_id'
      else
        '/issuing/sandbox/cards/get_card_transaction_by_id'
      end

    url =
      "#{path}?card_id=#{CGI.escape(card_id.to_s)}&client_transaction_reference=" \
      "#{CGI.escape(reference.to_s)}"
    response = fetch('get', url, nil)

    { data: response['data'], status: :ok }
  rescue StandardError => e
    { message: e.message, status: :unprocessable_entity }
  end

  def get_card_transaction_status(card_id:, reference: nil, client_transaction_reference: nil)
    raise ArgumentError, 'card_id is required' if card_id.blank?
    reference ||= client_transaction_reference
    raise ArgumentError, 'reference is required' if reference.blank?

    path =
      if Bridgecard::Config.live?
        '/issuing/cards/get_card_transaction_status'
      else
        '/issuing/sandbox/cards/get_card_transaction_status'
      end

    url =
      "#{path}?card_id=#{CGI.escape(card_id.to_s)}&client_transaction_reference=" \
      "#{CGI.escape(reference.to_s)}"
    response = fetch('get', url, nil)

    { data: response['data'], status: :ok }
  rescue StandardError => e
    { message: e.message, status: :unprocessable_entity }
  end

  def fetch_card_transaction_by_id(card_id:, reference:)
    fetch_transaction_payload(
      endpoint: :by_id,
      card_id: card_id,
      reference: reference
    )
  end

  def fetch_card_transaction_status(card_id:, reference:)
    fetch_transaction_payload(
      endpoint: :status,
      card_id: card_id,
      reference: reference
    )
  end

  def fetch_card_details(card_id:)
    raise ArgumentError, 'card_id is required' if card_id.blank?

    path =
      if Bridgecard::Config.live?
        "/issuing/cards/get_card_details?card_id=#{CGI.escape(card_id.to_s)}"
      else
        "/issuing/sandbox/cards/get_card_details?card_id=#{CGI.escape(card_id.to_s)}"
      end

    response = self.class.get(path, headers: headers, timeout: 10, open_timeout: 5)
    status_code = response.respond_to?(:code) ? response.code.to_i : nil
    parsed =
      if response.respond_to?(:parsed_response)
        response.parsed_response
      else
        response
      end

    if status_code && status_code >= 400
      return {
        ok: false,
        message: 'Bridgecard details fetch failed',
        error: {
          message: 'Bridgecard details fetch failed',
          status: status_code,
          snippet: sanitize_error_snippet(parsed)
        }
      }
    end

    data = parsed.is_a?(Hash) ? parsed['data'] : nil
    if data.blank?
      return {
        ok: false,
        message: 'Bridgecard details fetch failed',
        error: {
          message: 'Bridgecard details fetch failed',
          status: status_code,
          snippet: sanitize_error_snippet(parsed)
        }
      }
    end
    raw = data.is_a?(Hash) ? data : nil
    provider_status =
      raw&.fetch('status', nil) ||
      raw&.fetch('card_status', nil) ||
      raw&.fetch('state', nil) ||
      raw&.fetch('card_state', nil)
    is_active = raw&.fetch('is_active', nil)
    provider_status ||= is_active == true ? 'active' : is_active == false ? 'inactive' : nil

    payload = {
      provider_card_id: raw&.fetch('card_id', nil) || raw&.fetch('id', nil),
      provider_status: provider_status,
      is_active: is_active,
      livemode: raw&.fetch('livemode', nil),
      currency: raw&.fetch('currency', nil) || raw&.fetch('card_currency', nil) || raw&.fetch('balance_currency', nil),
      balance: raw&.fetch('balance', nil) || raw&.fetch('available_balance', nil) || raw&.fetch('card_balance', nil),
      raw: raw
    }

    { ok: true, data: payload }
  rescue StandardError => e
    {
      ok: false,
      message: 'Bridgecard details fetch failed',
      error: {
        message: 'Bridgecard details fetch failed',
        status: nil,
        snippet: sanitize_error_snippet(e.message)
      }
    }
  end

  def fetch_card_balance(card_id:)
    response = card_balance(card_id)
    return response if response[:status] != :ok

    data = response[:data].is_a?(Hash) ? response[:data] : nil
    { ok: true, data: data }
  rescue StandardError => e
    {
      ok: false,
      message: 'Bridgecard balance fetch failed',
      data: {
        status_code: nil,
        env_name: Bridgecard::Config.env_name,
        error_snippet: sanitize_error_snippet(e.message)
      }
    }
  end

  def freeze_card(card_id)
    raise ArgumentError, 'card_id is required' if card_id.blank?
    url = "#{issuing_endpoint('cards/freeze_card')}?card_id=#{card_id}"
    response = fetch('patch', url, nil)
    { data: response['data'], message: response['message'], status: :ok }
  rescue StandardError => e
    { message: e.message, status: :unprocessable_entity }
  end

  def unfreeze_card(card_id)
    raise ArgumentError, 'card_id is required' if card_id.blank?
    url = "#{issuing_endpoint('cards/unfreeze_card')}?card_id=#{card_id}"
    response = fetch('patch', url, nil)
    { data: response['data'], message: response['message'], status: :ok }
  rescue StandardError => e
    { message: e.message, status: :unprocessable_entity }
  end

  def mock_debit_transaction(card_id:)
    raise ArgumentError, 'card_id is required' if card_id.blank?

    raise StandardError, 'Mock debit is sandbox-only' if Bridgecard::Config.live?
    url = issuing_endpoint('cards/mock_debit_transaction')
    body = { card_id: card_id }.to_json
    response = fetch('patch', url, body)

    data = response['data'] || {}
    {
      data: {
        transaction_reference: data['transaction_reference'] || data['reference'],
        card_id: card_id
      },
      status: :ok
    }
  rescue StandardError => e
    { message: e.message, status: :unprocessable_entity }
  end

  # -----------------------------
  # FUND ISSUING WALLET (Bridge side)
  # -----------------------------
  def fund_wallet(card_params, user)
    raise ArgumentError, 'user is required' if user.blank?

    amount = card_params[:amount] || card_params['amount']
    currency = (card_params[:currency] || card_params['currency'] || 'USD').to_s.upcase
    wallet_type = (card_params[:wallet_type].presence || 'usd').to_s.downcase
    card_id = card_params[:card_id].presence
    card_id ||= user.cards.order(created_at: :desc).limit(1).pluck(:card_id).first

    unless wallet_type == 'usd'
      return { message: 'Cards are available only in Tunnel (USD).', status: :unprocessable_entity }
    end

    return { message: 'card_id is required to fund a card.', status: :unprocessable_entity } if card_id.blank?

    amount_usd = BigDecimal(amount.to_s) rescue 0.to_d
    return { message: 'Funding amount must be greater than 0.', status: :unprocessable_entity } unless amount_usd.positive?

    usd_wallet = user.usd_wallet
    raise StandardError, 'USD wallet not found. Activate tunnel first.' if usd_wallet.blank?

    cents = usd_wallet.money_to_cents(amount_usd)
    fee_policy = Pricing::CardFeePolicy.new
    funding_fee_usd = fee_policy.funding_fee_usd(amount_usd)
    total_debit_usd = amount_usd + funding_fee_usd
    total_cents = usd_wallet.money_to_cents(total_debit_usd)
    if wallet_balance_cents(usd_wallet) < total_cents
      return {
        message: 'Insufficient Tunnel balance to cover the funding amount and fee.',
        status: :unprocessable_entity,
        fee_breakdown: {
          funding_fee_usd: funding_fee_usd.to_f,
          total_debit_usd: total_debit_usd.to_f
        }
      }
    end

    reference = card_params[:transaction_reference].presence || "card-fund-#{SecureRandom.uuid}"
    fee_reference = "#{reference}:funding_fee"

    if Transaction.exists?(unique_transaction_id: reference)
      return { data: { transaction_reference: reference }, message: 'Funding already processed.', status: :ok }
    end

    ActiveRecord::Base.transaction do
      usd_wallet.transactions.create!(
        transaction_type: 'withdrawal',
        status: 'approved',
        amount: amount_usd,
        coin_type: 'bank',
        address: 'Virtual Card Funding (USD)',
        unique_transaction_id: reference,
        bridge_card_id: card_id,
        metadata: {
          subtype: 'card_funding_principal',
          fee_breakdown: {
            principal_usd: amount_usd.to_f,
            funding_fee_usd: funding_fee_usd.to_f,
            total_debit_usd: total_debit_usd.to_f
          }
        }
      )

      if funding_fee_usd.to_d.positive?
        usd_wallet.transactions.create!(
          transaction_type: 'withdrawal',
          status: 'approved',
          amount: funding_fee_usd,
          coin_type: 'bank',
          address: 'Virtual Card Funding Fee (USD)',
          unique_transaction_id: fee_reference,
          bridge_card_id: card_id,
          metadata: {
            subtype: 'card_funding_fee',
            fee_breakdown: {
              principal_usd: amount_usd.to_f,
              funding_fee_usd: funding_fee_usd.to_f,
              total_debit_usd: total_debit_usd.to_f
            }
          }
        )
      end

      usd_wallet.debit_cents!(total_cents)

      body = {
        card_id: card_id,
        amount: cents,
        transaction_reference: reference,
        currency: currency
      }.to_json
      url = issuing_endpoint('cards/fund_card_asynchronously')
      response = fetch('patch', url, body)
      data = response['data'].is_a?(Hash) ? response['data'] : {}
      data['fee_breakdown'] = {
        principal_usd: amount_usd.to_f,
        funding_fee_usd: funding_fee_usd.to_f,
        total_debit_usd: total_debit_usd.to_f
      }
      return { data: data, message: response['message'], status: :ok }
    end
  rescue StandardError => e
    if user&.usd_wallet && amount_usd.to_d.positive?
      user.usd_wallet.transactions.create!(
        transaction_type: 'withdrawal',
        status: 'failed',
        amount: amount_usd,
        coin_type: 'bank',
        address: 'Virtual Card Funding (USD)',
        unique_transaction_id: reference,
        bridge_card_id: card_id,
        metadata: { subtype: 'card_funding_principal' }
      )
    end
    { message: e.message, status: :unprocessable_entity }
  end

  # -----------------------------
  # UNLOAD CARD (Card -> Tunnel)
  # -----------------------------
  def unload_wallet(card_params, user)
    raise ArgumentError, 'user is required' if user.blank?

    amount = card_params[:amount] || card_params['amount']
    currency = (card_params[:currency] || card_params['currency'] || 'USD').to_s.upcase
    wallet_type = (card_params[:wallet_type].presence || 'usd').to_s.downcase
    card_id = card_params[:card_id].presence
    card_id ||= user.cards.order(created_at: :desc).limit(1).pluck(:card_id).first

    unless wallet_type == 'usd'
      return { message: 'Cards are available only in Tunnel (USD).', status: :unprocessable_entity }
    end

    return { message: 'card_id is required to withdraw from a card.', status: :unprocessable_entity } if card_id.blank?

    amount_usd = BigDecimal(amount.to_s) rescue 0.to_d
    return { message: 'Withdrawal amount must be greater than 0.', status: :unprocessable_entity } unless amount_usd.positive?

    usd_wallet = user.usd_wallet
    raise StandardError, 'USD wallet not found. Activate tunnel first.' if usd_wallet.blank?

    fee_policy = Pricing::CardFeePolicy.new
    withdrawal_fee_usd = fee_policy.withdrawal_fee_usd(amount_usd)
    if withdrawal_fee_usd.to_d >= amount_usd.to_d
      return {
        message: 'Withdrawal fee exceeds or equals the withdrawal amount.',
        status: :unprocessable_entity
      }
    end

    cents = usd_wallet.money_to_cents(amount_usd)
    reference = card_params[:transaction_reference].presence || "card-unload-#{SecureRandom.uuid}"
    txn = nil

    ActiveRecord::Base.transaction do
      txn = usd_wallet.transactions.create!(
        transaction_type: 'deposit',
        status: 'pending',
        amount: amount_usd,
        coin_type: 'mobile_bank',
        address: 'Virtual Card Withdrawal (USD)',
        unique_transaction_id: reference,
        bridge_card_id: card_id,
        metadata: {
          subtype: 'card_withdrawal_principal',
          withdrawal_fee_usd: withdrawal_fee_usd.to_f,
          gross_amount_usd: amount_usd.to_f,
          fee_breakdown: {
            principal_usd: amount_usd.to_f,
            withdrawal_fee_usd: withdrawal_fee_usd.to_f,
            total_credit_usd: (amount_usd - withdrawal_fee_usd).to_f
          }
        }
      )

      body = {
        card_id: card_id,
        amount: cents,
        transaction_reference: reference,
        currency: currency
      }.to_json

      url = issuing_endpoint('cards/unload_card_asynchronously')

      response = fetch('patch', url, body)
      return {
        data: (response['data'].is_a?(Hash) ? response['data'] : {}).merge(
          'fee_breakdown' => {
            principal_usd: amount_usd.to_f,
            withdrawal_fee_usd: withdrawal_fee_usd.to_f,
            total_credit_usd: (amount_usd - withdrawal_fee_usd).to_f
          }
        ),
        message: response['message'] || 'Withdrawal submitted. Pending confirmation.',
        status: :ok
      }
    end
  rescue StandardError => e
    txn&.update!(status: 'failed') if txn&.persisted?
    { message: e.message, status: :unprocessable_entity }
  end

  private
  def issuing_endpoint(path)
    clean = path.to_s.sub(%r{^/+}, '')
    Bridgecard::Config.live? ? "/issuing/#{clean}" : "/issuing/sandbox/#{clean}"
  end

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
    raw = sanitize_text(value).to_s
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
    encrypted_pin = encrypt_pin_for_bridge(pin)
    body = {
      cardholder_id: cardholder_id,
      card_type: card_type,
      card_brand: card_brand,
      card_currency: card_currency,
      card_limit: card_limit,
      transaction_reference: transaction_reference,
      funding_amount: funding_amount.to_s,
      pin: encrypted_pin,
      meta_data: {
        account_source: 'mobile',
        transaction_reference: transaction_reference
      }
    }.to_json

    fetch('post', issuing_endpoint('cards/create_card'), body)
  end

  def normalize_card_limit_cents(raw_limit)
    limit_value = BigDecimal(raw_limit.to_s) rescue 0.to_d
    return 500_000 if limit_value <= 0

    # Bridge expects cents for USD card limits.
    limit_value < 100_000 ? (limit_value * 100).to_i : limit_value.to_i
  end

  def minimum_funding_cents_for_limit(limit_cents)
    usd = CARD_MIN_FUNDING_USD_BY_LIMIT.fetch(limit_cents.to_i, CARD_ACTIVATION_MIN_USD)
    (usd * 100).to_i
  end

  def bridge_pin_encryption_secret
    if Bridgecard::Config.live?
      ENV['BRIDGECARD_LIVE_SECRET'].presence || ENV['BRIDGECARD_LIVE_TOKEN'].presence
    else
      ENV['BRIDGECARD_TEST_SECRET'].presence ||
        ENV['BRIDGE_CARD_TOKEN'].presence ||
        ENV['BRIDGE_TOKEN'].presence
    end
  end

  def encrypt_pin_for_bridge(pin_value)
    pin = pin_value.to_s.strip
    return '' if pin.blank?
    raise ArgumentError, 'PIN must be exactly 4 digits' unless pin.match?(/\A\d{4}\z/)

    secret = bridge_pin_encryption_secret.to_s.strip
    raise StandardError, 'Bridgecard secret key is missing for PIN encryption' if secret.blank?

    AES256.encrypt(pin, secret)
  end

  def build_card_create_metadata(user:, card:, wallet_type:, transaction_reference:)
    {
      account_source: 'mobile',
      user_id: user.id,
      local_card_id: card.id,
      wallet_type: wallet_type,
      transaction_reference: transaction_reference
    }
  end

  def sanitize_text(value)
    text = value.to_s.strip
    return nil if text.blank?
    return nil if %w[none null undefined n/a na nil].include?(text.downcase)

    text
  end

  def normalize_cardholder_params(account_params)
    first_name = sanitize_text(account_params[:first_name])
    last_name = sanitize_text(account_params[:last_name])
    address =
      sanitize_text(account_params[:address]) ||
      sanitize_text(account_params[:address_line1]) ||
      sanitize_text(account_params[:deliveryAddress])
    phone = sanitize_text(account_params[:phone_number]) || sanitize_text(account_params[:phone])
    city = sanitize_text(account_params[:city])
    state_variants = build_state_variants(account_params[:state])
    house_no = sanitize_text(account_params[:house_no])
    postal_code = sanitize_text(account_params[:postal_code])
    country = sanitize_text(account_params[:country]) || 'Nigeria'
    email = sanitize_text(account_params[:email]) || sanitize_text(account_params[:email_address])
    email ||= sanitize_text(account_params[:user_email]) || sanitize_text(account_params[:login])
    email = email.to_s.downcase if email.present?
    id_type = sanitize_text(account_params[:id_type]) || 'NIGERIAN_BVN_VERIFICATION'
    bvn = sanitize_text(account_params[:bvn]) || fetch_verified_bvn_from_kyc(account_params)
    id_no = sanitize_text(account_params[:id_no])
    id_image = sanitize_text(account_params[:id_image])
    selfie_image = sanitize_text(account_params[:selfie_image])
    account_source = sanitize_text(account_params[:account_source]) || 'mobile'
    user_id = account_params[:user_id].presence || account_params[:id].presence

    {
      first_name: first_name,
      last_name: last_name,
      address: address,
      phone: phone,
      city: city,
      state_variants: state_variants,
      house_no: house_no,
      postal_code: postal_code,
      country: country,
      email: email,
      id_type: id_type,
      bvn: bvn,
      id_no: id_no,
      id_image: id_image,
      selfie_image: selfie_image,
      account_source: account_source,
      user_id: user_id
    }
  end

  def validate_cardholder_required!(normalized, mode:)
    missing = []
    missing << 'first_name' if normalized[:first_name].blank?
    missing << 'last_name' if normalized[:last_name].blank?
    missing << 'address' if normalized[:address].blank?
    missing << 'city' if normalized[:city].blank?
    missing << 'state' if normalized[:state_variants].blank?
    missing << 'phone_number' if normalized[:phone].blank?
    missing << 'email' if normalized[:email].blank?
    missing << 'id_type' if normalized[:id_type].blank?

    id_type = normalized[:id_type].to_s.upcase
    if id_type == 'NIGERIAN_BVN_VERIFICATION'
      missing << 'bvn' if normalized[:bvn].blank?
      missing << 'selfie_image' if normalized[:selfie_image].blank?
    else
      missing << 'id_no' if normalized[:id_no].blank?
      missing << 'id_image' if normalized[:id_image].blank?
      missing << 'bvn' if id_type.start_with?('NIGERIAN_') && normalized[:bvn].blank?
      missing << 'selfie_image' if mode.to_sym == :sync && normalized[:selfie_image].blank?
    end

    raise ArgumentError, "Missing required cardholder fields: #{missing.join(', ')}" if missing.any?
  end

  def build_cardholder_payload(normalized)
    identity = { id_type: normalized[:id_type] }
    id_type = normalized[:id_type].to_s.upcase

    if id_type == 'NIGERIAN_BVN_VERIFICATION'
      identity[:bvn] = normalized[:bvn]
      identity[:selfie_image] = normalized[:selfie_image]
    else
      identity[:id_no] = normalized[:id_no]
      identity[:id_image] = normalized[:id_image]
      identity[:bvn] = normalized[:bvn] if normalized[:bvn].present?
      identity[:selfie_image] = normalized[:selfie_image] if normalized[:selfie_image].present?
    end

    {
      first_name: normalized[:first_name],
      last_name: normalized[:last_name],
      address: {
        address: normalized[:address],
        city: normalized[:city],
        state: normalized[:selected_state],
        country: normalized[:country],
        postal_code: normalized[:postal_code],
        house_no: normalized[:house_no]
      }.compact,
      phone: normalized[:phone],
      email_address: normalized[:email],
      identity: identity.compact,
      meta_data: {
        account_source: normalized[:account_source],
        user_id: normalized[:user_id]
      }.compact
    }
  end

  def upsert_cardholder_record!(normalized:, selected_state:, cardholder_id:, mode:)
    user_id = normalized[:user_id]
    raise ArgumentError, 'user_id is required for cardholder registration' if user_id.blank?

    card =
      if cardholder_id.present?
        Card.find_by(cardholder_id: cardholder_id) || Card.where(user_id: user_id).order(created_at: :desc).first
      else
        Card.where(user_id: user_id).order(created_at: :desc).first
      end
    card ||= Card.new(user_id: user_id)

    meta = card.meta_data.is_a?(Hash) ? card.meta_data.dup : {}
    cardholder_status = mode.to_sym == :sync ? 'verified' : 'pending_verification'
    meta['cardholder_kyc_status'] = cardholder_status
    meta['cardholder_registration_mode'] = mode.to_s
    meta['cardholder_status_updated_at'] = Time.current.iso8601

    card.assign_attributes(
      first_name: normalized[:first_name],
      last_name: normalized[:last_name],
      address: normalized[:address],
      phone: normalized[:phone],
      city: normalized[:city],
      state: selected_state,
      postal: normalized[:postal_code],
      bvn: normalized[:bvn],
      house_no: normalized[:house_no],
      id_type: normalized[:id_type],
      account_source: normalized[:account_source],
      cardholder_id: cardholder_id.presence || card.cardholder_id,
      meta_data: meta
    )

    if card.card_id.blank?
      card.status =
        case cardholder_status
        when 'verified' then 'pending'
        when 'pending_verification' then 'pending_verification'
        else card.status
        end
    end

    card.save!
    card
  end

  def fetch_verified_bvn_from_kyc(account_params)
    user_id = account_params[:user_id].presence || account_params[:id].presence
    return nil if user_id.blank?

    kyc = UserKyc.find_by(user_id: user_id)
    return nil if kyc.blank?
    return nil unless kyc.verified?

    sanitize_text(kyc.decrypted_bvn)
  rescue StandardError
    nil
  end

 def fetch(method, url, body)
  unless FeatureFlags.bridge_cards?
    raise StandardError, 'BRIDGE cards are disabled'
  end

  response =
    case method
    when 'get'
      self.class.get(url, headers: headers)
    when 'post'
      self.class.post(url, body: body, headers: headers)
    when 'patch'
      self.class.patch(url, body: body, headers: headers)
    else
      raise "Unsupported method: #{method}"
    end

  return response if response.success?

  parsed = response.respond_to?(:parsed_response) ? response.parsed_response : nil

  # Avoid dumping response bodies (could contain sensitive info depending on endpoint)
  if defined?(Rails) && Rails.logger
    Rails.logger.warn(
      "[BridgeCardService] request failed status=#{response.code} url=#{url}"
    )
  end

  detail_message =
    if parsed.is_a?(Hash)
      parsed.dig('detail', 0, 'msg') || parsed['message']
    else
      nil
    end

  raise(detail_message.presence || 'Bridge request failed')
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

  def headers
    return @headers if @headers.present?

    unless FeatureFlags.bridge_cards?
      raise StandardError, 'BRIDGE cards are disabled'
    end

    token = Bridgecard::Config.api_token
    if token.blank?
      raise StandardError, 'Bridgecard token is missing'
    end

    @headers = {
      'token' => "Bearer #{token}",
      'Accept' => 'application/json',
      'Content-Type' => 'application/json'
    }
  end

  def sanitize_error_snippet(value)
    text = value.to_s
    text = text.gsub(/Bearer\s+\S+/i, 'Bearer [redacted]')
    text = text.gsub(/token\s*[:=]\s*\S+/i, 'token=[redacted]')
    text = text[0, 300]
    text
  end

  def fetch_transaction_payload(endpoint:, card_id:, reference:)
    raise ArgumentError, 'card_id is required' if card_id.blank?
    raise ArgumentError, 'reference is required' if reference.blank?

    path =
      case endpoint
      when :by_id
        Bridgecard::Config.live? ? '/issuing/cards/get_card_transaction_by_id' : '/issuing/sandbox/cards/get_card_transaction_by_id'
      when :status
        Bridgecard::Config.live? ? '/issuing/cards/get_card_transaction_status' : '/issuing/sandbox/cards/get_card_transaction_status'
      else
        raise ArgumentError, 'endpoint is invalid'
      end

    url =
      "#{path}?card_id=#{CGI.escape(card_id.to_s)}&client_transaction_reference=" \
      "#{CGI.escape(reference.to_s)}"

    response = self.class.get(url, headers: headers, timeout: 10, open_timeout: 5)
    status_code = response.respond_to?(:code) ? response.code.to_i : nil
    parsed = response.respond_to?(:parsed_response) ? response.parsed_response : response

    if status_code && status_code >= 400
      return {
        ok: false,
        error: {
          message: 'Bridgecard transaction fetch failed',
          status: status_code,
          snippet: sanitize_error_snippet(parsed)
        }
      }
    end

    data = parsed.is_a?(Hash) ? (parsed['data'] || parsed) : nil
    return { ok: false, error: { message: 'Bridgecard transaction fetch failed', status: status_code, snippet: sanitize_error_snippet(parsed) } } if data.blank?

    { ok: true, data: data }
  rescue StandardError => e
    {
      ok: false,
      error: {
        message: 'Bridgecard transaction fetch failed',
        status: nil,
        snippet: sanitize_error_snippet(e.message)
      }
    }
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

  def log_cardholder_context(stage:, request_id:, mode:, normalized:, endpoint: nil, candidate_state: nil, payload: nil, response: nil, error: nil)
    return unless defined?(Rails) && Rails.logger

    profile = {
      request_id: request_id,
      mode: mode.to_s,
      user_id: normalized[:user_id],
      id_type: normalized[:id_type],
      email_masked: mask_email(normalized[:email]),
      phone_masked: mask_phone(normalized[:phone]),
      bvn_present: normalized[:bvn].present?,
      selfie_present: normalized[:selfie_image].present?,
      selfie_format: selfie_format(normalized[:selfie_image]),
      selfie_length: normalized[:selfie_image].to_s.length,
      state_variants_count: normalized[:state_variants].to_a.size
    }

    payload_summary = nil
    if payload.is_a?(Hash)
      identity = payload[:identity].is_a?(Hash) ? payload[:identity] : {}
      payload_summary = {
        payload_keys: payload.keys,
        identity_keys: identity.keys,
        payload_selfie_present: identity[:selfie_image].to_s.strip.present?,
        payload_selfie_format: selfie_format(identity[:selfie_image]),
        payload_selfie_length: identity[:selfie_image].to_s.length
      }
    end

    response_summary = nil
    if response.present?
      response_hash = response.respond_to?(:parsed_response) ? response.parsed_response : response
      response_summary = {
        message: response_hash.is_a?(Hash) ? response_hash['message'] : nil,
        has_data: response_hash.is_a?(Hash) && response_hash['data'].present?,
        cardholder_id_present: response_hash.is_a?(Hash) && response_hash.dig('data', 'cardholder_id').present?
      }
    end

    error_summary = nil
    if error.present?
      error_summary = {
        class: error.class.to_s,
        message: sanitize_error_snippet(error.message)
      }
    end

    Rails.logger.info(
      "[BridgeCardService] cardholder_trace stage=#{stage} " \
      "endpoint=#{endpoint} candidate_state=#{candidate_state} " \
      "profile=#{profile.inspect} payload=#{payload_summary.inspect} " \
      "response=#{response_summary.inspect} error=#{error_summary.inspect}"
    )
  rescue StandardError => e
    Rails.logger.warn("[BridgeCardService] cardholder_trace_log_failed message=#{e.message}")
  end

  def selfie_format(value)
    text = value.to_s.strip
    return 'absent' if text.blank?
    return 'data_url' if text.start_with?('data:image/')
    return 'https_url' if text.match?(/\Ahttps?:\/\//i)
    return 'base64_raw' if text.match?(/\A[A-Za-z0-9+\/=\s]+\z/) && text.length > 100

    'other'
  end

  def mask_email(email)
    text = email.to_s.strip
    return nil if text.blank?

    local, domain = text.split('@', 2)
    return '[invalid]' if domain.blank?
    return "***@#{domain}" if local.blank?

    visible = [local.length, 2].min
    "#{local[0, visible]}***@#{domain}"
  end

  def mask_phone(phone)
    digits = phone.to_s.gsub(/\D/, '')
    return nil if digits.blank?
    return "****#{digits[-4, 4]}" if digits.length >= 4

    '****'
  end
end
