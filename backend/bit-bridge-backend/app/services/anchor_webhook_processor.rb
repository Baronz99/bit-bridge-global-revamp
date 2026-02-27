# frozen_string_literal: true

require 'digest'

class AnchorWebhookProcessor
  def self.call(payload:, raw_body: nil, force: false)
    new(payload: payload, raw_body: raw_body, force: force).call
  end

  def initialize(payload:, raw_body:, force:)
    @payload = payload.is_a?(Hash) ? payload : {}
    @raw_body = raw_body.to_s
    @force = force
  end

  def call
    event_type = @payload['type'].presence || 'unknown'
    reference = extract_reference(@payload, @raw_body)

    record = AnchorWebhookEvent.find_or_initialize_by(event_type: event_type, reference: reference)
    record.payload = @payload
    record.received_at ||= Time.current
    record.status ||= 'received'
    record.save! if record.changed?

    return if record.processed_at.present? && record.status == 'processed' && !@force

    process_event!(event_type, @payload)
    record.update!(status: 'processed', processed_at: Time.current, error_message: nil)
  rescue StandardError => e
    record.update!(status: 'failed', error_message: e.message) if record&.persisted?
    raise
  end

  private

  def extract_reference(payload, raw_body)
    transfer_id = payload.dig('relationships', 'transfer', 'data', 'id')
    payment_id = payload.dig('attributes', 'payment', 'paymentId')
    payment_reference = payload.dig('attributes', 'payment', 'paymentReference')
    account_id = payload.dig('relationships', 'customer', 'data', 'id')
    event_id = payload['id']

    reference = transfer_id || payment_id || payment_reference || account_id || event_id
    return reference.to_s if reference.present?

    digest = Digest::SHA256.hexdigest(raw_body.to_s)
    "body:#{digest}"
  end

  def process_event!(event_type, payload)
    service = AnchorService.new
    normalized_event = event_type.to_s.strip.downcase

    case normalized_event
    when 'customer.identification.approved', 'customer.identification.pending', 'customer.identification.rejected'
      handle_kyc_event(event_type: normalized_event, payload: payload)
    when 'nip.inbound.completed'
      transfer_id = payload.dig('relationships', 'transfer', 'data', 'id')
      service.get_inbound_transfer(transfer_id) if transfer_id.present?
    when 'nip.inbound.settled'
      process_nip_inbound_settled!(payload: payload, service: service)
    when 'nip.transfer.successful'
      service.confirm_transfer_withdrawal(payload)
    when 'nip.transfer.failed', 'nip.transfer.reversed', 'nip.transfer.rejected'
      service.fail_transfer_withdrawal(payload)
    when 'payment.settled'
      if pooled_funding_payload?(payload)
        process_payin_received!(payload: payload, service: service)
      else
        service.fund_deposit_account(payload)
      end
    when 'payin.received'
      process_payin_received!(payload: payload, service: service)
    else
      if deposit_account_created_event?(normalized_event)
        handle_deposit_account_created(payload: payload)
        return
      end

      if event_type.to_s.include?('transfer') &&
         event_type.to_s.match?(/failed|reversed|rejected/)
        service.fail_transfer_withdrawal(payload)
      end
      # No-op for unhandled event types
    end
  end

  def handle_kyc_event(event_type:, payload:)
    account = resolve_anchor_account(payload)
    return if account.blank?

    next_status =
      if event_type.include?('approved')
        'verified'
      elsif event_type.include?('pending')
        'verifying'
      elsif event_type.include?('rejected')
        'unverified'
      end
    return if next_status.blank?

    account.update(status: next_status)
  end

  def handle_deposit_account_created(payload:)
    account = resolve_anchor_account(payload)
    return if account.blank?

    account_number = extract_webhook_account_number(payload)
    useable_id = extract_webhook_account_number_id(payload)
    updates = {}
    updates[:account_number] = account_number if numeric_account_number?(account_number)
    updates[:useable_id] = useable_id if useable_id.present?
    updates[:status] = 'completed' if updates[:account_number].present? && account.status != 'completed'
    return if updates.empty?

    account.update(updates)
  end

  def process_nip_inbound_settled!(payload:, service:)
    transfer_id = payload.dig('relationships', 'transfer', 'data', 'id')
    return if transfer_id.blank?

    inbound_transfer = service.fetch_inbound_transfer(transfer_id)
    unless inbound_transfer[:status] == :ok
      service.get_inbound_transfer(transfer_id)
      return
    end

    synthesized_payload = build_payin_payload_from_inbound_transfer(
      transfer_id: transfer_id,
      inbound_data: inbound_transfer[:data],
      original_payload: payload
    )

    if pooled_funding_payload?(synthesized_payload)
      process_payin_received!(payload: synthesized_payload, service: service)
    else
      service.fund_deposit_account(synthesized_payload)
    end
  end

  def build_payin_payload_from_inbound_transfer(transfer_id:, inbound_data:, original_payload:)
    data = inbound_data.is_a?(Hash) ? inbound_data : {}
    attributes = data['attributes'].is_a?(Hash) ? data['attributes'] : data

    {
      'id' => original_payload['id'],
      'type' => 'payment.settled',
      'attributes' => {
        'payment' => {
          'paymentId' => transfer_id,
          'paymentReference' => attributes['reference'] || attributes['paymentReference'] || transfer_id,
          'currency' => attributes['currency'] || 'NGN',
          'amount' => attributes['amount'],
          'narration' => attributes['narration'] || attributes['description'] || attributes['reference'],
          'paidAt' => attributes['settledAt'] || attributes['paidAt'] || attributes['createdAt'],
          'createdAt' => attributes['createdAt'],
          'counterParty' => {
            'accountNumber' => attributes['sourceAccountNumber'],
            'accountName' => attributes['sourceAccountName'],
            'bank' => {
              'name' => attributes.dig('sourceBank', 'name')
            }
          },
          'virtualNuban' => {
            'accountNumber' => attributes['destinationAccountNumber'] || attributes['accountNumber'],
            'accountName' => attributes['destinationAccountName'] || attributes['accountName'],
            'accountId' => data.dig('relationships', 'accountNumber', 'data', 'id')
          },
          'settlementAccount' => {
            'accountId' => data.dig('relationships', 'account', 'data', 'id')
          }
        }
      }
    }
  end

  def process_payin_received!(payload:, service:)
    reference = extract_payin_reference(payload)
    payin_id = extract_payin_id(payload)

    if reference.blank? && payin_id.present?
      payin_data = service.fetch_payin(payin_id)
      if payin_data[:status] == :ok
        reference = extract_payin_reference('data' => payin_data[:data])
        payload = payload.deep_dup
        payload['data'] = payin_data[:data]
      end
    end

    transaction_record = locate_wallet_funding_record(reference: reference, payin_id: payin_id)
    if transaction_record.present? && wallet_funding_record?(transaction_record)
      process_checkout_funding_payin!(
        payload: payload,
        reference: reference,
        payin_id: payin_id,
        transaction_record: transaction_record
      )
      return
    end

    process_pooled_funding_payin!(payload: payload, reference: reference, payin_id: payin_id)
  rescue ActiveRecord::RecordNotUnique
    nil
  end

  def process_checkout_funding_payin!(payload:, reference:, payin_id:, transaction_record:)
    transaction_record.with_lock do
      return if transaction_record.status.to_s == 'approved'

      funding_exchange = transaction_record.exchange
      return if funding_exchange.blank?
      return unless funding_exchange.deposit?
      return unless funding_exchange.wallet.present?

      amount, currency, raw_amount, amount_scale = extract_payin_amount_and_currency(payload, funding_exchange.amount)

      metadata = funding_exchange.metadata.is_a?(Hash) ? funding_exchange.metadata.deep_dup : {}
      metadata['provider'] = 'anchor'
      metadata['purpose'] = 'wallet_fund'
      metadata['anchor_payin_id'] = payin_id if payin_id.present?
      metadata['anchor_payment_reference'] ||= reference
      metadata['anchor_payin_event'] = 'payin.received'
      metadata['anchor_payin_currency'] = currency if currency.present?
      metadata['anchor_amount_raw'] = raw_amount.to_s if raw_amount.present?
      metadata['anchor_amount_scale'] = amount_scale
      metadata['anchor_amount_major'] = amount.to_s('F')
      metadata['anchor_payin_payload'] = payload if payload.is_a?(Hash)
      metadata['anchor_funding_initialized_transaction_id'] = funding_exchange.id

      settled_deposit = funding_exchange.wallet.transactions.create!(
        status: :approved,
        transaction_type: :deposit,
        coin_type: :bank,
        amount: amount,
        metadata: metadata
      )

      funding_metadata = funding_exchange.metadata.is_a?(Hash) ? funding_exchange.metadata.deep_dup : {}
      funding_metadata['provider'] = 'anchor'
      funding_metadata['purpose'] = 'wallet_fund'
      funding_metadata['checkout_state'] = 'settled'
      funding_metadata['settled_transaction_id'] = settled_deposit.id
      funding_metadata['settled_at'] = extract_payin_settled_at(payload).iso8601
      funding_exchange.update!(metadata: funding_metadata)

      updates = {
        status: 'approved',
        event_type: 'anchor.webhook.payin.received',
        exchange: settled_deposit,
        amount: amount
      }
      updates[:transaction_id] = payin_id if payin_id.present? && transaction_record.transaction_id.blank?
      transaction_record.update!(updates)
    end
  end

  def process_pooled_funding_payin!(payload:, reference:, payin_id:)
    provider_reference = payin_id.presence || reference.presence || "payin-#{Digest::SHA256.hexdigest(payload.to_json)}"
    amount, currency, raw_amount, amount_scale = extract_payin_amount_and_currency(payload, 0)

    inbound_transfer = InboundBankTransfer.find_or_initialize_by(
      provider: 'anchor',
      provider_reference: provider_reference
    )

    inbound_transfer.assign_attributes(
      amount_cents: (amount.to_d * 100).round(0).to_i,
      currency: currency.to_s.upcase.presence || 'NGN',
      sender_name: extract_payin_sender_name(payload),
      narration: extract_payin_narration(payload),
      received_at: extract_payin_settled_at(payload),
      raw_payload: payload,
      status: inbound_transfer.status.presence || 'unmatched'
    )

    return if inbound_transfer.credited_transaction_id.present?

    funding_intent = find_funding_intent_for_payin(reference: reference, payload: payload)
    unless funding_intent
      inbound_transfer.status = 'unmatched'
      inbound_transfer.save!
      return
    end

    FundingIntent.transaction do
      funding_intent.lock!
      inbound_transfer.save! if inbound_transfer.new_record? || inbound_transfer.changed?
      inbound_transfer.lock!

      if funding_intent.credited_transaction_id.present?
        inbound_transfer.update!(
          status: 'credited',
          matched_user: funding_intent.user,
          funding_intent: funding_intent,
          credited_transaction_id: funding_intent.credited_transaction_id
        )
        return
      end

      if funding_intent.expires_at < Time.current
        inbound_transfer.update!(
          status: 'review',
          matched_user: funding_intent.user,
          funding_intent: funding_intent
        )
        return
      end

      tx = create_pooled_credit_transaction!(
        funding_intent: funding_intent,
        provider_reference: provider_reference,
        amount: amount,
        currency: currency,
        raw_amount: raw_amount,
        amount_scale: amount_scale,
        payload: payload,
        payin_id: payin_id,
        reference: reference
      )

      intent_metadata = funding_intent.metadata.is_a?(Hash) ? funding_intent.metadata.deep_dup : {}
      intent_metadata['credited_at'] = Time.current.utc.iso8601
      intent_metadata['anchor_payin_id'] = payin_id if payin_id.present?
      intent_metadata['anchor_provider_reference'] = provider_reference
      funding_intent.update!(
        status: 'credited',
        credited_transaction: tx,
        metadata: intent_metadata
      )

      upsert_funding_transaction_record!(
        funding_intent: funding_intent,
        provider_reference: provider_reference,
        payin_id: payin_id,
        amount: amount,
        transaction: tx
      )

      inbound_transfer.update!(
        status: 'credited',
        matched_user: funding_intent.user,
        funding_intent: funding_intent,
        credited_transaction: tx
      )
    end
  end

  def create_pooled_credit_transaction!(funding_intent:, provider_reference:, amount:, currency:, raw_amount:, amount_scale:, payload:, payin_id:, reference:)
    metadata = {
      'provider' => 'anchor',
      'purpose' => 'wallet_fund_pooled',
      'funding_intent_id' => funding_intent.id,
      'anchor_provider_reference' => provider_reference,
      'anchor_payin_id' => payin_id,
      'anchor_payment_reference' => reference,
      'anchor_amount_raw' => raw_amount.to_s,
      'anchor_amount_scale' => amount_scale,
      'anchor_amount_major' => amount.to_s('F'),
      'anchor_payin_currency' => currency,
      'anchor_payin_payload' => payload
    }.compact

    funding_intent.user.ngn_wallet.transactions.create!(
      status: :approved,
      transaction_type: :deposit,
      coin_type: :bank,
      amount: amount,
      unique_transaction_id: "anchor-pooled-#{provider_reference}",
      metadata: metadata
    )
  rescue ActiveRecord::RecordNotUnique
    funding_intent.user.ngn_wallet.transactions.find_by!(unique_transaction_id: "anchor-pooled-#{provider_reference}")
  end

  def upsert_funding_transaction_record!(funding_intent:, provider_reference:, payin_id:, amount:, transaction:)
    record = TransactionRecord.find_or_initialize_by(reference: funding_intent.reference)
    record.exchange = transaction
    record.status = 'approved'
    record.event_type = 'anchor.webhook.payin.received'
    record.transaction_id = payin_id.presence || provider_reference
    record.amount = amount
    record.description = 'Anchor pooled wallet funding'
    record.save!
  end

  def find_funding_intent_for_payin(reference:, payload:)
    candidates = [
      reference,
      extract_payin_reference_from_narration(payload)
    ].compact.map { |value| value.to_s.strip.upcase }.uniq

    return nil if candidates.empty?

    FundingIntent.where(reference: candidates).order(created_at: :desc).first
  end

  def extract_payin_reference_from_narration(payload)
    narration = extract_payin_narration(payload)
    return nil if narration.blank?

    match = narration.to_s.upcase.match(/BBG-[A-Z0-9]{6}-[A-Z0-9]{4}/)
    match&.to_s
  end

  def extract_payin_sender_name(payload)
    payin = payload.dig('attributes', 'payIn') || payload.dig('data', 'attributes', 'payIn') || {}
    payment = payload.dig('attributes', 'payment') || payload.dig('data', 'attributes', 'payment') || {}

    payin['senderName'].presence ||
      payin.dig('counterParty', 'accountName').presence ||
      payment.dig('counterParty', 'accountName').presence ||
      payment['senderName'].presence
  end

  def extract_payin_narration(payload)
    payin = payload.dig('attributes', 'payIn') || payload.dig('data', 'attributes', 'payIn') || {}
    payment = payload.dig('attributes', 'payment') || payload.dig('data', 'attributes', 'payment') || {}

    payin['narration'].presence || payment['narration'].presence || payin['reference'].presence
  end

  def wallet_funding_record?(transaction_record)
    return false if transaction_record.exchange.blank?

    tx = transaction_record.exchange
    metadata = tx.metadata.is_a?(Hash) ? tx.metadata : {}
    wallet_funding_purpose = metadata['purpose'].to_s == 'wallet_fund'
    anchor_provider = metadata['provider'].to_s == 'anchor'
    tx.deposit? &&
      (transaction_record.event_type.to_s == 'checkout.init' || wallet_funding_purpose) &&
      anchor_provider
  end

  def extract_payin_reference(payload)
    return nil unless payload.is_a?(Hash)

    payin = payload.dig('attributes', 'payIn') || payload.dig('data', 'attributes', 'payIn') || {}
    payment = payload.dig('attributes', 'payment') || payload.dig('data', 'attributes', 'payment') || {}

    payin['reference'].presence ||
      payin['paymentReference'].presence ||
      payload.dig('attributes', 'reference').presence ||
      payload.dig('data', 'attributes', 'reference').presence ||
      payment['paymentReference'].presence ||
      payment['reference'].presence
  end

  def extract_payin_id(payload)
    return nil unless payload.is_a?(Hash)

    payin = payload.dig('attributes', 'payIn') || payload.dig('data', 'attributes', 'payIn') || {}
    payment = payload.dig('attributes', 'payment') || payload.dig('data', 'attributes', 'payment') || {}

    payin['id'].presence || payment['paymentId'].presence || payload.dig('data', 'id').presence
  end

  def pooled_funding_payload?(payload)
    reference = extract_payin_reference(payload).to_s.upcase
    return true if reference.start_with?('BBG-')

    extract_payin_reference_from_narration(payload).present?
  end

  def extract_payin_amount_and_currency(payload, fallback_amount)
    payin = payload.dig('attributes', 'payIn') || payload.dig('data', 'attributes', 'payIn') || {}
    payment = payload.dig('attributes', 'payment') || payload.dig('data', 'attributes', 'payment') || {}

    raw_amount = payin['amount'] || payment['amount']
    currency = payin['currency'] || payment['currency'] || 'NGN'
    scale = anchor_amount_scale

    amount =
      begin
        value = BigDecimal(raw_amount.to_s)
        if currency.to_s.upcase == 'NGN'
          (value / scale).round(2)
        else
          value
        end
      rescue StandardError
        fallback_amount.to_d
      end

    [amount, currency, raw_amount, scale]
  end

  def anchor_amount_scale
    configured = ENV['ANCHOR_AMOUNT_SCALE'].to_s
    parsed = BigDecimal(configured)
    return parsed if parsed.positive?

    BigDecimal('100')
  rescue StandardError
    BigDecimal('100')
  end

  def locate_wallet_funding_record(reference:, payin_id:)
    record = reference.present? ? TransactionRecord.find_by(reference: reference) : nil
    return record if record.present?
    return nil if payin_id.blank?

    TransactionRecord.find_by(transaction_id: payin_id)
  end

  def extract_payin_settled_at(payload)
    raw =
      payload.dig('attributes', 'payIn', 'paidAt') ||
      payload.dig('data', 'attributes', 'payIn', 'paidAt') ||
      payload.dig('attributes', 'payment', 'paidAt') ||
      payload.dig('data', 'attributes', 'payment', 'paidAt') ||
      payload.dig('attributes', 'payment', 'createdAt') ||
      payload.dig('data', 'attributes', 'payment', 'createdAt')

    parsed = raw.present? ? Time.zone.parse(raw.to_s) : nil
    parsed || Time.current
  rescue StandardError
    Time.current
  end

  def resolve_anchor_account(payload)
    customer_id = payload.dig('relationships', 'customer', 'data', 'id').to_s.presence
    account_id = payload.dig('relationships', 'account', 'data', 'id').to_s.presence
    account_number_id =
      payload.dig('relationships', 'accountNumber', 'data', 'id').to_s.presence ||
      payload.dig('relationships', 'virtualNuban', 'data', 'id').to_s.presence
    account_number = extract_webhook_account_number(payload)

    scope = Account.where(vendor: 'anchor')
    return scope.find_by(account_id: customer_id) if customer_id.present? && scope.find_by(account_id: customer_id).present?
    return scope.find_by(useable_id: account_id) if account_id.present? && scope.find_by(useable_id: account_id).present?
    return scope.find_by(useable_id: account_number_id) if account_number_id.present? && scope.find_by(useable_id: account_number_id).present?
    return scope.find_by(account_number: account_number) if numeric_account_number?(account_number)

    nil
  end

  def extract_webhook_account_number(payload)
    payload.dig('attributes', 'accountNumber', 'accountNumber').to_s.presence ||
      payload.dig('attributes', 'virtualNuban', 'accountNumber').to_s.presence ||
      payload.dig('attributes', 'payment', 'virtualNuban', 'accountNumber').to_s.presence ||
      payload.dig('data', 'attributes', 'accountNumber').to_s.presence ||
      payload.dig('data', 'attributes', 'virtualNuban', 'accountNumber').to_s.presence
  end

  def extract_webhook_account_number_id(payload)
    payload.dig('attributes', 'accountNumber', 'id').to_s.presence ||
      payload.dig('data', 'id').to_s.presence ||
      payload.dig('relationships', 'accountNumber', 'data', 'id').to_s.presence
  end

  def numeric_account_number?(value)
    value.to_s.match?(/\A\d{10}\z/)
  end

  def deposit_account_created_event?(normalized_event)
    event = normalized_event.to_s
    return false if event.blank?

    has_account_number_hint =
      event.include?('accountnumber') || event.include?('account.number') || event.include?('virtualnuban')
    has_created_or_linked_hint =
      event.include?('created') || event.include?('linked') || event.include?('assigned')

    has_account_number_hint && has_created_or_linked_hint
  end
end
