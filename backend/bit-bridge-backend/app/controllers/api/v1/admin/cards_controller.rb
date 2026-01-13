# frozen_string_literal: true

module Api
  module V1
    module Admin
      class CardsController < ApplicationController
        before_action :authenticate_user!
        before_action :ensure_super_admin!
        before_action :ensure_bridge_cards_enabled!
        before_action :set_card
        before_action :ensure_card_debug_enabled!, only: %i[
          mock_debit
          provider_details
          provider_transactions
          provider_transaction
          provider_transaction_status
          enrich_transaction
          sync_transactions
        ]

        def mock_debit
          if Bridgecard::Config.debug_context[:livemode_expected]
            return render json: { message: 'Mock debit only allowed in sandbox', data: { card_id: @card.id } },
                          status: :unprocessable_entity
          end
          return render json: { message: 'Mock debit is disabled in production.', data: { card_id: @card.id } },
                        status: :forbidden if Rails.env.production? || Rails.env.staging?
          return render json: { message: 'Card provider id is missing.', data: { card_id: @card.id } },
                        status: :unprocessable_entity if @card.card_id.blank?

          service = BridgeCardService.new
          response = service.mock_debit_transaction(card_id: @card.card_id)

          if response[:status] == :ok
            sync_result = Bridgecard::SyncCardTransactions.call(card: @card, page_limit: 1)
            synced_events = sync_result[:count].to_i if sync_result[:status] == :ok
            warning =
              if sync_result[:status] == :ok && synced_events.to_i.zero?
                'Mock debit queued, but no transactions were synced yet. Try Refresh Events.'
              elsif sync_result[:status] != :ok
                "Mock debit queued, but sync failed: #{sync_result[:message] || 'unknown error'}"
              end

            Rails.logger.info(
              "[AdminMockDebit] card_id=#{@card.id} provider_card_id=#{@card.card_id} " \
              "transaction_reference=#{response.dig(:data, :transaction_reference)} " \
              "synced_events=#{synced_events.to_i}"
            )

            render json: {
              message: 'Mock debit queued',
              data: {
                transaction_reference: response.dig(:data, :transaction_reference),
                card_id: @card.card_id,
                synced_events: synced_events.to_i
              },
              warning: warning
            }, status: :ok
          else
            status = response[:status] == :unprocessable_entity ? :unprocessable_entity : :bad_gateway
            render json: {
              message: response[:message] || 'Mock debit failed',
              data: { card_id: @card.card_id }
            }, status: status
          end
        end

        def provider_details
          return render json: { message: 'Card provider id is missing.', data: { id: @card.id } },
                        status: :unprocessable_entity if @card.card_id.blank?

          response = BridgeCardService.new.fetch_card_details(card_id: @card.card_id)
          if response[:ok]
            data = response[:data].is_a?(Hash) ? response[:data] : {}
            raw = data[:raw].is_a?(Hash) ? data[:raw] : {}
            meta_currency = @card.meta_data.is_a?(Hash) ? @card.meta_data['provider_currency'] : nil
            currency = data[:currency].presence || @card.card_currency || meta_currency
            balance = normalize_provider_balance(data[:balance], currency)
            payload = {
              provider_card_id: data[:provider_card_id] || @card.card_id,
              provider_status: data[:provider_status],
              provider_livemode: data[:livemode],
              currency: currency,
              balance: balance,
              raw: sanitize_payload(raw),
              debug_context: Bridgecard::Config.debug_context
            }

            render json: { message: 'Provider details fetched', data: payload }, status: :ok
          else
            render json: {
              message: response[:message] || 'Unable to fetch provider details.',
              data: {
                id: @card.id,
                status_code: response.dig(:error, :status),
                env_name: Bridgecard::Config.env_name,
                error_snippet: response.dig(:error, :snippet)
              }
            }, status: :bad_gateway
          end
        end

        def refresh_status
          return render json: { message: 'Card provider id is missing.' }, status: :unprocessable_entity if @card.card_id.blank?

          if rate_limited_status_refresh?
            retry_after = status_refresh_retry_after
            return render json: {
              message: 'Card status can only be refreshed every 10 seconds.',
              data: {
                id: @card.id,
                provider_status: @card.provider_status,
                provider_updated_at: @card.provider_updated_at,
                internal_status: @card.status
              },
              retry_after_seconds: retry_after
            }, status: :too_many_requests
          end

          result = Bridgecard::CardStatusRefresher.call(card: @card)
          if result[:status] == :ok || result[:ok]
            data = result[:data].is_a?(Hash) ? result[:data] : {}
            payload = {
              id: @card.id,
              provider_status: @card.provider_status,
              provider_updated_at: @card.provider_updated_at,
              provider_livemode: @card.provider_livemode,
              currency: data[:currency],
              balance: data[:balance]
            }

            if FeatureFlags.admin_card_debug?
              payload[:raw] = sanitize_payload(data[:raw].is_a?(Hash) ? data[:raw] : {})
              payload[:debug_context] = Bridgecard::Config.debug_context
            end

            render json: {
              message: 'Card status refreshed',
              data: payload
            }, status: :ok
          else
            render json: {
              message: result[:message] || 'Unable to refresh card status.',
              data: {
                id: @card.id,
                status_code: result[:status_code] || result.dig(:error, :status),
                error_snippet: result[:error_snippet] || result.dig(:error, :snippet)
              }
            }, status: :bad_gateway
          end
        end

        def refresh_provider_status
          refresh_status
        end

        def sync_transactions
          return render json: { message: 'Card provider id is missing.' }, status: :unprocessable_entity if @card.card_id.blank?

          limit = params[:limit].to_i
          page_size = limit.positive? ? limit : 20

          result = Bridgecard::SyncCardTransactions.call(card: @card, page_limit: 1, page_size: page_size)
          if result[:status] == :ok
            latest_events =
              CardEvent.where(card_id: @card.card_id)
                       .order(created_at: :desc)
                       .limit(5)
                       .select(:id, :event_name, :status, :currency, :amount, :created_at)

            render json: {
              message: 'Card transactions synced',
              data: {
                card_id: @card.card_id,
                synced: true,
                upserted_count: result[:count].to_i,
                synced_count: result[:synced_count].to_i,
                created_count: result[:created_count].to_i,
                updated_count: result[:updated_count].to_i,
                enriched_count: result[:enriched_count].to_i,
                enrichment_failed_count: result[:enrichment_failed_count].to_i,
                enrichment_skipped_count: result[:enrichment_skipped_count].to_i,
                latest_provider_tx_at: result[:latest_provider_tx_at]&.iso8601,
                last_sync_at: @card.reload.last_synced_at&.iso8601,
                latest_events: latest_events
              }
            }, status: :ok
          else
            render json: {
              message: result[:message] || 'Unable to sync card transactions.',
              data: { card_id: @card.card_id }
            }, status: :bad_gateway
          end
        end

        def provider_transactions
          return render json: { message: 'Card provider id is missing.', data: { id: @card.id } },
                        status: :unprocessable_entity if @card.card_id.blank?

          page = params[:page].to_i
          page = 1 if page <= 0
          response = BridgeCardService.new.list_card_transactions(card_id: @card.card_id, page: page, count: 20)

          if response[:status] == :ok
            render json: {
              message: 'Provider transactions fetched',
              data: response[:data]
            }, status: :ok
          else
            render json: {
              message: response[:message] || 'Unable to fetch provider transactions.',
              data: { id: @card.id }
            }, status: :bad_gateway
          end
        end

        def provider_transaction
          reference = params[:reference].to_s
          return render json: { message: 'reference is required', data: { id: @card.id } },
                        status: :unprocessable_entity if reference.blank?

          response = BridgeCardService.new.get_card_transaction_by_id(
            card_id: @card.card_id,
            client_transaction_reference: reference
          )

          if response[:status] == :ok
            event = CardEvent.find_by(
              card_id: @card.card_id,
              provider_transaction_reference: reference
            )
            metadata = event&.metadata.is_a?(Hash) ? event.metadata : {}
            raw = response[:data].is_a?(Hash) ? response[:data] : {}
            fx_data = CardEvent.extract_fx_fields(
              raw,
              settled_currency: raw['currency'] || raw['transaction_currency'],
              settled_amount: raw['amount']
            )
            render json: {
              message: 'Provider transaction fetched',
              data: raw.merge(
                'raw_payload' => sanitize_payload(raw),
                'extracted_fx' => serialize_fx_fields(fx_data),
                'enriched_at' => metadata['enriched_at']
              )
            }, status: :ok
          else
            render json: {
              message: response[:message] || 'Unable to fetch provider transaction.',
              data: { id: @card.id }
            }, status: :bad_gateway
          end
        end

        def enrich_transaction
          reference = params[:reference].to_s
          return render json: { message: 'reference is required', data: { id: @card.id } },
                        status: :unprocessable_entity if reference.blank?

          event = CardEvent.find_by(
            card_id: @card.card_id,
            provider_transaction_reference: reference
          )
          return render json: { message: 'Card event not found', data: { reference: reference } },
                        status: :not_found if event.blank?

          force = params[:force].to_s == '1'
          result = Bridgecard::EnrichTransactionDetails.call(
            card: @card,
            provider_transaction_reference: reference,
            card_event: event,
            force: force
          )

          if result[:ok]
            fx_payload = serialize_fx_fields(
              CardEvent.extract_fx_fields(
                event.metadata.is_a?(Hash) ? (event.metadata['raw_payload_details'] || {}) : {},
                settled_currency: event.currency,
                settled_amount: event.amount
              )
            )
            render json: {
              message: result[:message] || 'Enrichment complete',
              data: {
                reference: reference,
                enriched: result[:enriched] || result[:data]&.fetch(:enriched, false),
                extracted_fx: fx_payload,
                debug: result[:data]
              }
            }, status: :ok
          else
            render json: {
              message: result[:message] || 'Unable to enrich transaction.',
              data: {
                reference: reference,
                debug: result[:error]
              }
            }, status: :bad_gateway
          end
        end

        def provider_transaction_status
          reference = params[:reference].to_s
          return render json: { message: 'reference is required', data: { id: @card.id } },
                        status: :unprocessable_entity if reference.blank?

          response = BridgeCardService.new.get_card_transaction_status(
            card_id: @card.card_id,
            client_transaction_reference: reference
          )

          if response[:status] == :ok
            render json: { message: 'Provider transaction status fetched', data: response[:data] }, status: :ok
          else
            render json: {
              message: response[:message] || 'Unable to fetch provider transaction status.',
              data: { id: @card.id }
            }, status: :bad_gateway
          end
        end

        def events
          limit = params[:limit].to_i
          limit = 20 if limit <= 0
          limit = 50 if limit > 50

          events =
            CardEvent
            .where(card_id: @card.card_id)
            .order(created_at: :desc)
            .limit(limit)
            .select(:id, :event_name, :provider_transaction_reference, :status, :currency, :amount, :created_at, :metadata, :raw_payload)

          payload = events.map do |event|
            raw = event.raw_payload.is_a?(Hash) ? event.raw_payload : {}
            sanitized_raw = sanitize_payload(raw)
            metadata = event.metadata.is_a?(Hash) ? event.metadata : {}
            {
              id: event.id,
              event_name: event.event_name,
              provider_transaction_reference: event.provider_transaction_reference,
              status: event.status,
              currency: event.currency,
              amount: event.amount,
              created_at: event.created_at,
              metadata: metadata,
              raw_payload: FeatureFlags.admin_card_debug? ? sanitized_raw : nil,
              extracted_fields: extract_event_fields(raw, event)
            }
          end

          render json: { data: payload }, status: :ok
        end

        private

        def ensure_super_admin!
          return if current_user&.super_admin?

          render json: { message: 'Not authorized' }, status: :forbidden
        end

        def ensure_bridge_cards_enabled!
          return if FeatureFlags.bridge_cards?

          render json: { message: 'Bridge cards are disabled' }, status: :forbidden
        end

        def ensure_card_debug_enabled!
          return if FeatureFlags.admin_card_debug?

          render json: { message: 'Not found' }, status: :not_found
        end

        def set_card
          @card = Card.find(params[:id])
        end

        def sandbox_env?
          Bridgecard::Config.env_name == 'sandbox'
        end

        def rate_limited_status_refresh?
          return false if @card.provider_updated_at.blank?

          @card.provider_updated_at > 10.seconds.ago
        end

        def status_refresh_retry_after
          return 0 if @card.provider_updated_at.blank?

          [(10 - (Time.current - @card.provider_updated_at)).ceil, 0].max
        end

        def normalize_provider_balance(value, currency)
          return nil if value.nil?

          amount = BigDecimal(value.to_s)
          code = currency.to_s.upcase

          if amount.frac.zero?
            int_val = amount.to_i
            if int_val >= 1000 && (int_val % 100).zero?
              return (amount / 100).round(2).to_f if code.blank? || code == 'USD'
            end
          end

          amount.round(2).to_f
        rescue StandardError
          nil
        end

        def extract_event_fields(raw, event = nil)
          metadata = event&.metadata.is_a?(Hash) ? event.metadata : {}
          base = {
            provider_transaction_reference: raw['bridgecard_transaction_reference'] ||
              raw['client_transaction_reference'] ||
              raw['transaction_reference'],
            client_transaction_reference: raw['client_transaction_reference'],
            card_transaction_type: raw['card_transaction_type'] || raw['transaction_type'],
            livemode: raw['livemode'],
            transaction_date: raw['transaction_date'] || raw['transaction_timestamp'],
            billing_currency: raw['billing_currency'] || raw['billingCurrency'],
            billing_amount: raw['billing_amount'] || raw['billingAmount'],
            merchant_currency: raw['merchant_currency'] || raw['merchantCurrency'],
            merchant_amount: raw['merchant_amount'] || raw['merchantAmount'],
            settled_currency: raw['settled_currency'] || raw['settledCurrency'],
            settled_amount: raw['settled_amount'] || raw['settledAmount'],
            exchange_rate: raw['exchange_rate'] || raw['fx_rate'] || raw['exchangeRate'],
            merchant_name: raw['merchant_name'] || raw['merchantName'],
            merchant_country: raw['merchant_country'] || raw['merchantCountry'],
            mcc: raw['mcc'] || raw['merchant_category_code']
          }

          if event
            base[:merchant_currency] ||= event.respond_to?(:merchant_currency) ? event.merchant_currency : nil
            base[:merchant_amount] ||= event.respond_to?(:merchant_amount) ? event.merchant_amount : nil
            base[:billing_currency] ||= event.respond_to?(:billing_currency) ? event.billing_currency : nil
            base[:billing_amount] ||= event.respond_to?(:billing_amount) ? event.billing_amount : nil
            base[:fx_implied_rate] ||= event.respond_to?(:fx_implied_rate) ? event.fx_implied_rate : nil
            base[:fx_reference_rate] ||= event.respond_to?(:fx_reference_rate) ? event.fx_reference_rate : nil
            base[:fx_margin_usd] ||= event.respond_to?(:fx_margin_usd) ? event.fx_margin_usd : nil
            base[:merchant_currency] ||= metadata['merchant_currency']
            base[:merchant_amount] ||= metadata['merchant_amount']
            base[:billing_currency] ||= metadata['billing_currency']
            base[:billing_amount] ||= metadata['billing_amount']
            base[:exchange_rate] ||= metadata['exchange_rate'] || metadata['fx_rate']
            base[:fx_reference_rate] ||= metadata['fx_reference_rate']
            base[:fx_margin_usd] ||= metadata['fx_margin_usd']
          end

          base.compact
        end

        def serialize_fx_fields(fx_data)
          return {} unless fx_data.is_a?(Hash)

          {
            merchant_currency: fx_data[:merchant_currency],
            merchant_amount: fx_data[:merchant_amount]&.to_s('F'),
            billing_currency: fx_data[:billing_currency],
            billing_amount: fx_data[:billing_amount]&.to_s('F'),
            fx_implied_rate: fx_data[:fx_implied_rate]&.to_s('F'),
            fx_reference_rate: fx_data[:fx_reference_rate]&.to_s('F'),
            fx_margin_usd: fx_data[:fx_margin_usd]&.to_s('F'),
            is_foreign: fx_data[:is_foreign]
          }.compact
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
      end
    end
  end
end
