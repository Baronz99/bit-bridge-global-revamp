# frozen_string_literal: true

class CardEvent < ApplicationRecord
  belongs_to :user, optional: true

  class << self
    def provider_reference_from(data)
      return nil unless data.is_a?(Hash)

      data['bridgecard_transaction_reference'].presence ||
        data['client_transaction_reference'].presence ||
        data['transaction_reference'].presence
    end

    def normalize_status(event_name:, data:)
      explicit = data.is_a?(Hash) ? data['status'].presence : nil
      return explicit if explicit.present?

      event = event_name.to_s
      status_from_event = event.split('.').last
      return status_from_event if %w[successful failed declined pending].include?(status_from_event)
      return 'successful' if event.include?('successful')
      return 'failed' if event.include?('failed')
      return 'declined' if event.include?('declined')

      'notification'
    end

    def normalize_event_name(event_name, data: nil)
      base = event_name.to_s.split('.').first if event_name.present?
      return base if base.present?

      tx_type = data.is_a?(Hash) ? (data['card_transaction_type'] || data['transaction_type']) : nil
      tx_type = tx_type.to_s.downcase
      return 'card_debit_event' if tx_type == 'debit'
      return 'card_credit_event' if tx_type == 'credit'
      return 'card_unload_event' if tx_type == 'unload'

      nil
    end

    def parse_transaction_time(data)
      return nil unless data.is_a?(Hash)

      if data['transaction_timestamp'].present?
        parse_transaction_timestamp(data['transaction_timestamp'])
      elsif data['transaction_date'].present?
        parse_provider_datetime(data['transaction_date'])
      elsif data['created_at'].present?
        parse_provider_datetime(data['created_at'].to_s)
      end
    end

    def upsert_bridgecard_event!(event_name:, data:, raw_payload:, card: nil, user_id: nil)
      return if event_name.blank? && !data.is_a?(Hash)

      normalized_event = normalize_event_name(event_name, data: data)
      provider_reference = provider_reference_from(data)
      fallback_reference = data.is_a?(Hash) ? data['transaction_reference'].presence : nil
      provider_reference ||= fallback_reference

      card_id = data.is_a?(Hash) ? data['card_id'].presence : nil
      card_id ||= card&.card_id

      event_status = normalize_status(event_name: event_name, data: data)
      transaction_at = parse_transaction_time(data)

      record =
        if provider_reference.present? && card_id.present? && normalized_event.present?
          find_or_initialize_by(
            card_id: card_id,
            provider_transaction_reference: provider_reference,
            event_name: normalized_event
          )
        else
          new
        end

      fx_data = extract_fx_fields(
        data,
        settled_currency: data.is_a?(Hash) ? (data['currency'] || data['transaction_currency']) : nil,
        settled_amount: data.is_a?(Hash) ? data['amount'] : nil
      )
      resolved_currency = data.is_a?(Hash) ? (data['currency'] || data['transaction_currency']) : nil
      resolved_fee = extract_fee_fields(
        data: data,
        event_name: normalized_event,
        currency: resolved_currency
      )

      record.assign_attributes(
        event: event_name.presence || record.event || 'unknown',
        status: event_status,
        event_name: normalized_event.presence || record.event_name,
        event_status: event_status,
        card_id: card_id.presence || record.card_id,
        provider_card_id: card_id.presence || record.provider_card_id,
        cardholder_id: data.is_a?(Hash) ? data['cardholder_id'] : nil,
        currency: data.is_a?(Hash) ? (data['currency'] || data['transaction_currency']) : nil,
        amount: data.is_a?(Hash) ? data['amount'] : nil,
        transaction_reference: data.is_a?(Hash) ? data['transaction_reference'] : nil,
        provider_transaction_reference: provider_reference,
        card_transaction_type: data.is_a?(Hash) ? (data['card_transaction_type'] || data['transaction_type']) : nil,
        merchant_category_code: data.is_a?(Hash) ? (data['merchant_category_code'] || data['mcc']) : nil,
        merchant_name: data.is_a?(Hash) ? data['merchant_name'] : nil,
        description: data.is_a?(Hash) ? (data['description'] || data['message'] || data['narration']) : nil,
        decline_reason: data.is_a?(Hash) ? (data['decline_reason'] || data['reason']) : nil,
        fee_amount: resolved_fee[:fee_amount],
        fee_currency: resolved_fee[:fee_currency],
        transaction_at: transaction_at,
        livemode: data.is_a?(Hash) ? data['livemode'] : nil,
        raw_payload: raw_payload,
        user_id: user_id,
        merchant_amount: fx_data[:merchant_amount],
        merchant_currency: fx_data[:merchant_currency],
        billing_amount: fx_data[:billing_amount],
        billing_currency: fx_data[:billing_currency],
        fx_implied_rate: fx_data[:fx_implied_rate],
        fx_reference_rate: fx_data[:fx_reference_rate],
        fx_margin_usd: fx_data[:fx_margin_usd],
        fx_markup_usd: fx_data[:fx_markup_usd]
      )

      metadata = record.metadata.is_a?(Hash) ? record.metadata.dup : {}
      metadata['bitbridge_fee_percent'] = metadata.fetch('bitbridge_fee_percent', nil)
      metadata['bitbridge_fee_amount'] = metadata.fetch('bitbridge_fee_amount', nil)

      if data.is_a?(Hash)
        metadata['livemode'] = data['livemode'] if data.key?('livemode')
        metadata['description'] = data['description'] || data['narration'] || data['message']
        metadata['foreign_exchange_fee'] = data['foreign_exchange_fee'] if data.key?('foreign_exchange_fee')
        metadata['interchange_revenue'] = data['interchange_revenue'] if data.key?('interchange_revenue')
        metadata['partner_interchange_fee'] = data['partner_interchange_fee'] if data.key?('partner_interchange_fee')
        metadata['client_transaction_reference'] = data['client_transaction_reference']
        metadata['transaction_timestamp'] = data['transaction_timestamp']
        metadata['transaction_date'] = data['transaction_date']
        metadata['billing_currency'] = fx_data[:billing_currency] if fx_data[:billing_currency].present?
        metadata['billing_amount'] = format_decimal(fx_data[:billing_amount]) if fx_data[:billing_amount].present?
        metadata['merchant_currency'] = fx_data[:merchant_currency] if fx_data[:merchant_currency].present?
        metadata['merchant_amount'] = format_decimal(fx_data[:merchant_amount]) if fx_data[:merchant_amount].present?
        raw_exchange_rate = data['exchange_rate'] || data['fx_rate'] || data['exchangeRate']
        metadata['exchange_rate'] = raw_exchange_rate || format_decimal(fx_data[:fx_implied_rate])
        metadata['fx_rate'] = raw_exchange_rate || format_decimal(fx_data[:fx_implied_rate])

        metadata['is_foreign'] = fx_data[:is_foreign]
        metadata['fx_discovery_present'] = fx_data[:fx_discovery_present]

        enriched = data['enriched_data'].is_a?(Hash) ? data['enriched_data'] : {}
        merchant = enriched['merchant'].is_a?(Hash) ? enriched['merchant'] : {}
        metadata['merchant'] = {
          name: merchant['name'] || enriched['merchant_name'],
          website: merchant['website'] || enriched['merchant_website'],
          code: merchant['code'] || enriched['merchant_code'],
          city: merchant['city'] || enriched['merchant_city'],
          logo: merchant['logo'] || enriched['merchant_logo'],
          group: merchant['group'] || enriched['transaction_group'],
          category: merchant['category'] || enriched['transaction_category'],
          recurring: enriched['is_recurring']
        }.compact

        fx_discovery = data.each_with_object({}) do |(key, value), acc|
          next unless key.to_s.match?(/fx|exchange|settlement|billing|merchant_currency/i)

          acc[key] = value
        end
        metadata['fx_discovery'] = fx_discovery if fx_discovery.present?
      end

      record.metadata = metadata

      record.save!
      record
    end

    MERCHANT_CURRENCY_KEYS = %w[
      merchant_currency
      original_currency
      transaction_currency
      currency_code
      fx_currency
    ].freeze

    MERCHANT_AMOUNT_KEYS = %w[
      merchant_amount
      original_amount
      transaction_amount
      local_amount
      fx_amount
    ].freeze

    BILLING_CURRENCY_KEYS = %w[
      billing_currency
      settlement_currency
      billingCurrency
    ].freeze

    BILLING_AMOUNT_KEYS = %w[
      billing_amount
      settlement_amount
      billingAmount
    ].freeze

    def extract_fx_fields(data, settled_currency:, settled_amount:)
      return empty_fx_fields unless data.is_a?(Hash)

      merchant_currency = normalize_currency(find_first_value(data, MERCHANT_CURRENCY_KEYS))
      merchant_amount = parse_amount(find_first_value(data, MERCHANT_AMOUNT_KEYS))
      billing_currency = normalize_currency(find_first_value(data, BILLING_CURRENCY_KEYS))
      billing_amount = parse_amount(find_first_value(data, BILLING_AMOUNT_KEYS))

      settled_curr = normalize_currency(settled_currency)
      settled_amt = parse_amount(settled_amount)

      foreign_fee = data.key?('foreign_exchange_fee') ? parse_amount(data['foreign_exchange_fee']) : nil

      fx_discovery_present =
        merchant_currency.present? ||
        merchant_amount.present? ||
        billing_currency.present? ||
        billing_amount.present? ||
        foreign_fee.present?

      is_foreign =
        foreign_fee.present? ||
        (merchant_currency.present? && merchant_currency != 'USD')

      fx_implied_rate =
        if merchant_currency.present? &&
           merchant_amount.present? &&
           settled_curr == 'USD' &&
           settled_amt.present?
          (settled_amt / merchant_amount).round(6)
        end

      fx_reference_rate =
        if merchant_currency.present? && merchant_currency != 'USD'
          Fx::ReferenceRate.quote(from_currency: merchant_currency, to_currency: 'USD')
        end

      fx_margin_usd =
        if fx_reference_rate.present? &&
           merchant_amount.present? &&
           settled_curr == 'USD' &&
           settled_amt.present?
          reference_usd = (merchant_amount * fx_reference_rate).round(6)
          (settled_amt - reference_usd).round(6)
        end

      {
        merchant_amount: merchant_amount,
        merchant_currency: merchant_currency,
        billing_amount: billing_amount,
        billing_currency: billing_currency,
        fx_implied_rate: fx_implied_rate,
        fx_reference_rate: fx_reference_rate,
        fx_margin_usd: fx_margin_usd,
        fx_markup_usd: nil,
        is_foreign: is_foreign,
        fx_discovery_present: fx_discovery_present
      }
    rescue StandardError
      empty_fx_fields
    end

    def empty_fx_fields
      {
        merchant_amount: nil,
        merchant_currency: nil,
        billing_amount: nil,
        billing_currency: nil,
        fx_implied_rate: nil,
        fx_reference_rate: nil,
        fx_margin_usd: nil,
        fx_markup_usd: nil,
        is_foreign: false,
        fx_discovery_present: false
      }
    end

    def normalize_currency(value)
      raw = value.to_s.strip.upcase
      return nil unless raw.match?(/\A[A-Z]{3}\z/)

      raw
    end

    def parse_amount(value)
      return nil if value.nil?

      decimal = BigDecimal(value.to_s) rescue nil
      return nil if decimal.nil? || decimal <= 0

      decimal
    end

    def find_first_value(data, keys)
      keys.each do |key|
        return data[key] if data.key?(key)
        sym = key.to_sym
        return data[sym] if data.key?(sym)
      end
      nil
    end

    def format_decimal(value)
      return value unless value.is_a?(BigDecimal)

      value.to_s('F')
    end

    def extract_fee_fields(data:, event_name:, currency:)
      return { fee_amount: nil, fee_currency: nil } unless data.is_a?(Hash)

      normalized_currency = normalize_currency(data['fee_currency'] || currency)
      explicit_fee_raw = data['fee_amount']
      explicit_fee_raw = data['fee'] if explicit_fee_raw.nil?
      explicit_fee_raw = data['provider_fee'] if explicit_fee_raw.nil?
      explicit_fee_raw = data['partner_interchange_fee'] if explicit_fee_raw.nil?

      explicit_fee = parse_money_amount(explicit_fee_raw, normalized_currency)
      if explicit_fee&.positive?
        return {
          fee_amount: explicit_fee,
          fee_currency: normalized_currency || infer_fee_currency(event_name: event_name, data: data)
        }
      end

      fallback = fallback_fee_amount(data: data, event_name: event_name)
      return { fee_amount: nil, fee_currency: nil } unless fallback&.positive?

      {
        fee_amount: fallback,
        fee_currency: 'USD'
      }
    end

    def fallback_fee_amount(data:, event_name:)
      breakdown = data['fee_breakdown'].is_a?(Hash) ? data['fee_breakdown'] : {}
      normalized_event = event_name.to_s

      funding_fee = parse_usd_amount(data['funding_fee_usd'] || breakdown['funding_fee_usd'])
      return funding_fee if normalized_event == 'card_credit_event' && funding_fee&.positive?

      withdrawal_fee = parse_usd_amount(data['withdrawal_fee_usd'] || breakdown['withdrawal_fee_usd'])
      return withdrawal_fee if normalized_event == 'card_unload_event' && withdrawal_fee&.positive?

      provider_fee = parse_usd_amount(data['provider_fee_usd'] || breakdown['provider_fee_usd'])
      return provider_fee if provider_fee&.positive?

      partner_fee = parse_usd_amount(data['partner_interchange_fee'])
      return partner_fee if partner_fee&.positive?

      nil
    end

    def infer_fee_currency(event_name:, data:)
      return 'USD' if event_name.to_s.start_with?('card_')

      normalize_currency(data['currency'] || data['transaction_currency'])
    end

    def parse_usd_amount(value)
      parse_money_amount(value, 'USD')
    end

    def parse_money_amount(value, currency)
      return nil if value.nil?

      raw = value.to_s.strip
      decimal = BigDecimal(raw) rescue nil
      return nil if decimal.nil? || decimal <= 0

      normalized_currency = normalize_currency(currency)
      return decimal / 100 if normalized_currency == 'USD' && raw.match?(/\A-?\d+\z/)

      decimal
    end

    def parse_transaction_timestamp(value)
      raw = value.to_s.strip
      return nil if raw.blank?

      seconds = BigDecimal(raw)
      # Bridge payloads sometimes send epoch milliseconds.
      seconds /= 1000 if seconds > 9_999_999_999
      Time.zone.at(seconds.to_f)
    rescue StandardError
      nil
    end

    def parse_provider_datetime(value)
      raw = value.to_s.strip
      return nil if raw.blank?

      # If the payload already includes timezone info, trust it directly.
      if raw.match?(/(?:Z|[+-]\d{2}:?\d{2})\z/)
        return Time.zone.parse(raw)
      end

      provider_tz_name = ENV.fetch('BRIDGECARD_TRANSACTION_TIMEZONE', 'Africa/Lagos')
      provider_tz = ActiveSupport::TimeZone[provider_tz_name]
      return Time.zone.parse(raw) unless provider_tz

      parsed_in_provider_tz = provider_tz.parse(raw)
      return nil unless parsed_in_provider_tz

      parsed_in_provider_tz.in_time_zone(Time.zone)
    rescue StandardError
      nil
    end
  end
end
