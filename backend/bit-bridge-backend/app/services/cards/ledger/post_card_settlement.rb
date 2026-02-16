# frozen_string_literal: true

module Cards
  module Ledger
    class PostCardSettlement
      def self.call(card:, card_event:)
        new(card: card, card_event: card_event).call
      end

      def initialize(card:, card_event:)
        @card = card
        @card_event = card_event
      end

      def call
        return failure('card_missing') if @card.blank?
        return failure('card_event_missing') if @card_event.blank?

        provider_reference = @card_event.provider_transaction_reference.presence || @card_event.transaction_reference.presence
        provider_reference ||= "card-event-#{@card_event.id}"

        quote = Pricing::CardPricing.quote(extract_pricing_payload(@card_event.raw_payload))
        metadata = @card_event.metadata.is_a?(Hash) ? @card_event.metadata : {}
        already_posted =
          metadata['ledger_posted'] == true &&
          metadata['provider_reference'].to_s == provider_reference.to_s
        return success('already_posted', provider_reference, quote) if already_posted

        mark_ledger_posted(provider_reference, quote)
        success('posted', provider_reference, quote)
      rescue StandardError => e
        Rails.logger.warn("[PostCardSettlement] failed message=#{e.message}")
        failure('posting_failed', nil, nil, e.message)
      end

      private

      def mark_ledger_posted(provider_reference, quote = nil)
        metadata = @card_event.metadata.is_a?(Hash) ? @card_event.metadata.dup : {}
        metadata['ledger_posted'] = true
        metadata['provider_reference'] = provider_reference
        metadata['settlement_source'] = 'provider_card_balance'

        if quote
          metadata['principal_usd'] = quote[:principal_usd]&.to_f
          metadata['provider_fee_usd'] = quote[:provider_fee_usd]&.to_f
          metadata['bitbridge_fee_usd'] = quote[:bitbridge_fee_usd]&.to_f
          metadata['fx_markup_usd'] = quote[:fx_markup_usd]&.to_f
          metadata['total_debit_usd'] = quote[:total_debit_usd]&.to_f
          metadata['provider_fee_rule'] = quote[:provider_fee_rule]
          metadata['bitbridge_fee_rule'] = quote[:bitbridge_fee_rule]
          metadata['pricing_mode'] = quote[:pricing_mode]
        end

        @card_event.update!(metadata: metadata)
      end

      def extract_pricing_payload(raw_payload)
        return {} unless raw_payload.is_a?(Hash)
        return raw_payload['data'] if raw_payload['data'].is_a?(Hash)

        raw_payload
      end

      def success(status, provider_reference, quote = nil)
        { status: :ok, code: status, provider_reference: provider_reference, quote: quote }
      end

      def failure(code, provider_reference = nil, quote = nil, message = nil)
        { status: :error, code: code, provider_reference: provider_reference, quote: quote, message: message }
      end
    end
  end
end
