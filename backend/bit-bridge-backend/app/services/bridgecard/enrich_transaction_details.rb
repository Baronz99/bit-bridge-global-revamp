# frozen_string_literal: true

module Bridgecard
  class EnrichTransactionDetails
    COOLDOWN_WINDOW = 10.minutes

    def self.call(card:, provider_transaction_reference:, card_event:, force: false)
      new(card: card, provider_transaction_reference: provider_transaction_reference, card_event: card_event, force: force).call
    end

    def initialize(card:, provider_transaction_reference:, card_event:, force: false)
      @card = card
      @provider_reference = provider_transaction_reference
      @card_event = card_event
      @force = force
      @service = BridgeCardService.new
    end

    def call
      return failure('card_id not available') if @card&.card_id.blank?
      return failure('provider reference missing') if @provider_reference.blank?
      return failure('card_event missing') if @card_event.blank?

      metadata = @card_event.metadata.is_a?(Hash) ? @card_event.metadata.dup : {}
      last_enriched_at = parse_time(metadata['enriched_at'])
      if !@force && last_enriched_at && last_enriched_at > COOLDOWN_WINDOW.ago
        return { ok: true, skipped: true, message: 'Recently enriched', data: { enriched: false } }
      end

      payload, source, error = fetch_payload
      return failure('Unable to fetch transaction details', error) if payload.nil?

      sanitized = sanitize_payload(payload)
      fx_data = CardEvent.extract_fx_fields(
        payload,
        settled_currency: payload['currency'] || payload['transaction_currency'],
        settled_amount: payload['amount']
      )

      @card_event.assign_attributes(
        merchant_amount: fx_data[:merchant_amount],
        merchant_currency: fx_data[:merchant_currency],
        billing_amount: fx_data[:billing_amount],
        billing_currency: fx_data[:billing_currency],
        fx_implied_rate: fx_data[:fx_implied_rate],
        fx_reference_rate: fx_data[:fx_reference_rate],
        fx_margin_usd: fx_data[:fx_margin_usd],
        fx_markup_usd: fx_data[:fx_markup_usd]
      )

      metadata['raw_payload_details'] = sanitized
      metadata['enriched_at'] = Time.current.iso8601
      metadata['enrichment_source'] = source
      metadata['fx_discovery_present'] = fx_data[:fx_discovery_present]
      metadata['is_foreign'] = fx_data[:is_foreign]

      @card_event.metadata = metadata
      @card_event.save!

      {
        ok: true,
        enriched: true,
        data: {
          enriched: true,
          extracted_fx: fx_data,
          source: source
        }
      }
    end

    private

    def fetch_payload
      response = @service.fetch_card_transaction_by_id(
        card_id: @card.card_id,
        reference: @provider_reference
      )
      return [response[:data], 'by_id', nil] if response[:ok]

      status_response = @service.fetch_card_transaction_status(
        card_id: @card.card_id,
        reference: @provider_reference
      )
      return [status_response[:data], 'status', nil] if status_response[:ok]

      [nil, nil, response[:error] || status_response[:error]]
    end

    def parse_time(value)
      return nil if value.blank?

      Time.zone.parse(value.to_s)
    rescue StandardError
      nil
    end

    def sanitize_payload(payload)
      return payload unless payload.is_a?(Hash)

      scrub_keys = %w[pan card_pan full_pan card_number cvv cvc track1 track2 track_data]

      payload.each_with_object({}) do |(key, value), acc|
        if scrub_keys.include?(key.to_s.downcase)
          acc[key] = '[redacted]'
        elsif value.is_a?(Hash)
          acc[key] = sanitize_payload(value)
        elsif value.is_a?(Array)
          acc[key] = value.map { |item| item.is_a?(Hash) ? sanitize_payload(item) : item }
        else
          acc[key] = value
        end
      end
    end

    def failure(message, error_payload = nil)
      error_data = error_payload.is_a?(Hash) ? error_payload : {}
      { ok: false, message: message, error: error_data }
    end
  end
end
