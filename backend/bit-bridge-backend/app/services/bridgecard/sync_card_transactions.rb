# frozen_string_literal: true

module Bridgecard
  class SyncCardTransactions
    DEFAULT_PAGE_LIMIT = 5
    DEFAULT_PAGE_SIZE = 20

    def self.call(card:, page_limit: DEFAULT_PAGE_LIMIT, page_size: DEFAULT_PAGE_SIZE)
      new(card: card, page_limit: page_limit, page_size: page_size).call
    end

    def initialize(card:, page_limit:, page_size:)
      @card = card
      @page_limit = page_limit.to_i.positive? ? page_limit.to_i : DEFAULT_PAGE_LIMIT
      @page_size = page_size.to_i.positive? ? page_size.to_i : DEFAULT_PAGE_SIZE
      @service = BridgeCardService.new
    end

    def call
      return { status: :unprocessable_entity, message: 'card_id not available' } if @card&.card_id.blank?

      page = 1
      upserted = 0
      created = 0
      updated = 0
      synced = 0
      enriched = 0
      enrichment_failed = 0
      enrichment_skipped = 0
      enrichment_attempted = 0
      latest_tx_at = nil

      while page <= @page_limit
        response = @service.get_card_transactions(card_id: @card.card_id, page: page, count: @page_size)
        return response if response[:status] != :ok

        data = response[:data]
        items = extract_items(data)
        break if items.blank?

        items.each do |item|
          event_name = event_name_for(item)
          record = CardEvent.upsert_bridgecard_event!(
            event_name: event_name,
            data: item,
            raw_payload: item,
            card: @card,
            user_id: @card.user_id
          )
          upserted += 1
          synced += 1

          if record.previous_changes.key?('id')
            created += 1
          else
            updated += 1
          end

          tx_time = CardEvent.parse_transaction_time(item)
          if tx_time && (latest_tx_at.nil? || tx_time > latest_tx_at)
            latest_tx_at = tx_time
          end

          next unless enrichment_attempted < 5
          next unless record.card_transaction_type.to_s.downcase == 'debit'

          metadata = record.metadata.is_a?(Hash) ? record.metadata : {}
          fx_present = metadata['fx_discovery_present'] || record.merchant_currency.present? || record.billing_currency.present?
          next if fx_present

          enrichment_attempted += 1
          enrich_result = Bridgecard::EnrichTransactionDetails.call(
            card: @card,
            provider_transaction_reference: record.provider_transaction_reference,
            card_event: record
          )

          if enrich_result[:ok] && enrich_result[:data]&.fetch(:enriched, false)
            enriched += 1
          elsif enrich_result[:ok] && enrich_result[:skipped]
            enrichment_skipped += 1
          else
            enrichment_failed += 1
          end
        end

        break if items.size < @page_size

        page += 1
        sleep(3)
      end

      @card.update_columns(last_synced_at: Time.current) if @card&.persisted?

      {
        status: :ok,
        count: upserted,
        synced_count: synced,
        created_count: created,
        updated_count: updated,
        latest_provider_tx_at: latest_tx_at,
        enriched_count: enriched,
        enrichment_failed_count: enrichment_failed,
        enrichment_skipped_count: enrichment_skipped
      }
    rescue StandardError => e
      { status: :unprocessable_entity, message: e.message }
    end

    private

    def extract_items(data)
      return [] if data.blank?
      return data if data.is_a?(Array)

      data['transactions'] ||
        data['items'] ||
        data['data'] ||
        []
    end

    def event_name_for(item)
      status = item['status'].to_s.downcase
      status = 'successful' if status == 'success'
      status = 'failed' if status == 'failure'

      tx_type = (item['card_transaction_type'] || item['transaction_type']).to_s.downcase
      return "card_debit_event.#{status}" if tx_type == 'debit'
      return "card_credit_event.#{status}" if tx_type == 'credit'
      return "card_unload_event.#{status}" if tx_type == 'unload'

      "card_event.#{status.presence || 'notification'}"
    end
  end
end
