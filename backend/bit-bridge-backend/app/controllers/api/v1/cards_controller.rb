# frozen_string_literal: true

module Api
  module V1
    class CardsController < ApplicationController
      before_action :set_card, only: %i[show update destroy]

      before_action :ensure_bridge_cards_enabled!,
                    only: %i[
                      setup_card
                      setup_status
                      register_cardholder
                      create_card
                      get_all_states
                      fund_wallet
                      unload_wallet
                      funding_status
                      details
                      balance
                      reveal
                      freeze
                      unfreeze
                      history
                      insights
                    ]

      before_action :ensure_tier2!,
                    only: %i[
                      index
                      user_card
                      setup_card
                      setup_status
                      register_cardholder
                      create_card
                      fund_wallet
                      unload_wallet
                      funding_status
                      details
                      balance
                      reveal
                      freeze
                      unfreeze
                      show
                      update
                      destroy
                      history
                      insights
                    ],
                    message: 'Complete Tier 2 verification to use cards.'

      # IMPORTANT:
      # Rails resolves rescue_from handlers in reverse order of declaration.
      # If StandardError is declared after RecordNotFound, it will swallow RecordNotFound => 500.
      rescue_from StandardError do |e|
        raise e if e.is_a?(ActiveRecord::RecordNotFound)

        Rails.logger.error(
          "[CardsController] #{e.class}: #{e.message}\n#{e.backtrace&.first(10)&.join("\n")}"
        )

        render json: { message: 'Something went wrong while processing your request.' },
               status: :internal_server_error
      end

      rescue_from ActiveRecord::RecordNotFound do
        render json: { message: 'Card not found' }, status: :not_found
      end

      # GET /api/v1/cards
      def index
        render json: current_user.cards
      end

      # GET /api/v1/cards/user_card
      def user_card
        card =
          current_user
          .cards
          .where.not(status: Card::TERMINAL_STATUSES)
          .order(created_at: :asc)
          .last
        render json: { data: card, status: :ok }
      end

      # POST /api/v1/cards/setup_card
      # One-button orchestration:
      # 1) ensure cardholder profile is submitted
      # 2) wait for verification webhook if pending
      # 3) create+fund card once verified (fee + min funding)
      def setup_card
        idempotency_key = request.headers['X-Idempotency-Key'].to_s.strip
        if idempotency_key.blank?
          return render_setup_error(
            code: 'CARD_SETUP_VALIDATION_FAILED',
            message: 'X-Idempotency-Key header is required.',
            state: 'failed',
            next_action: 'retry_setup',
            retryable: false,
            status: :unprocessable_entity
          )
        end

        payload_hash = Digest::SHA256.hexdigest(request.raw_post.to_s)
        cached = read_setup_idempotency(idempotency_key)
        if cached.present?
          if cached[:payload_hash].present? && cached[:payload_hash] != payload_hash
            return render_setup_error(
              code: 'CARD_SETUP_IDEMPOTENCY_CONFLICT',
              message: 'Idempotency key reuse with different payload is not allowed.',
              state: 'failed',
              next_action: 'retry_setup',
              retryable: false,
              status: :conflict
            )
          end

          return render json: cached[:body], status: cached[:status]
        end

        response = current_user.with_lock { process_setup_card_request }
        write_setup_idempotency(idempotency_key, payload_hash: payload_hash, body: response[:body], status: response[:status])
        render json: response[:body], status: response[:status]
      end

      # GET /api/v1/cards/setup_status
      def setup_status
        card = latest_cardholder_profile_for(current_user)
        pricing = setup_pricing_payload

        if card.blank?
          return render_setup_success(
            message: 'Card setup has not started.',
            state: 'not_started',
            next_action: 'start_setup',
            data: {
              card_id: nil,
              provider_card_id: nil,
              cardholder_id: nil,
              pricing: pricing
            }
          )
        end

        meta = card.meta_data.is_a?(Hash) ? card.meta_data : {}
        kyc_status = meta['cardholder_kyc_status'].to_s.downcase
        state, next_action =
          if card.card_id.present?
            ['active', 'none']
          elsif %w[pending_verification manual_review].include?(kyc_status)
            ['cardholder_pending', 'wait_webhook']
          elsif kyc_status == 'failed'
            ['cardholder_failed', 'fix_profile']
          elsif kyc_status == 'verified'
            ['ready_for_funding', 'create_and_fund']
          else
            ['not_started', 'start_setup']
          end

        render_setup_success(
          message: 'Card setup status fetched.',
          state: state,
          next_action: next_action,
          data: {
            card_id: card.id,
            provider_card_id: card.card_id,
            cardholder_id: card.cardholder_id,
            pricing: pricing,
            cardholder_status: kyc_status.presence || 'idle'
          }
        )
      end

      # POST /api/v1/cards/register_cardholder
      def register_cardholder
        existing_cardholder = latest_cardholder_profile_for(current_user)
        if existing_cardholder.present?
          meta = existing_cardholder.meta_data.is_a?(Hash) ? existing_cardholder.meta_data : {}
          kyc_status = meta['cardholder_kyc_status'].to_s
          return render json: {
            data: existing_cardholder,
            message: "Cardholder profile already exists#{": #{kyc_status.tr('_', ' ')}" if kyc_status.present?}."
          }, status: :ok
        end

        service = BridgeCardService.new

        profile_hash = current_user.user_profile&.attributes&.symbolize_keys || {}

        processed =
          current_user.attributes.symbolize_keys
                      .merge(profile_hash)
                      .merge(card_params.to_h.symbolize_keys)

        processed[:email] ||= processed[:email_address].presence || current_user.email
        processed[:phone] ||= processed[:phone_number].presence
        processed[:user_id] ||= current_user.id
        processed[:request_id] ||= request.request_id

        registration_mode =
          if card_params[:registration_mode].to_s.casecmp('sync').zero?
            :sync
          else
            :async
          end

        Rails.logger.info(
          "[CardsController] register_cardholder request_id=#{request.request_id} " \
          "user_id=#{current_user.id} mode=#{registration_mode} " \
          "id_type=#{processed[:id_type].presence || 'NIGERIAN_BVN_VERIFICATION'} " \
          "selfie_present=#{processed[:selfie_image].to_s.strip.present?}"
        )

        service_response = service.register_cardholder(processed, mode: registration_mode)

        if service_response[:status] == :ok
          render json: { data: service_response[:data], message: service_response[:message] }, status: :ok
        else
          Rails.logger.warn(
            "[CardsController] register_cardholder_failed request_id=#{request.request_id} " \
            "user_id=#{current_user.id} mode=#{registration_mode} message=#{service_response[:message].inspect}"
          )
          render json: { message: service_response[:message] }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/cards/get_all_states?country=NG
      def get_all_states
        service = BridgeCardService.new
        request_params = params.permit(:country, :country_code, :country_name).to_h.symbolize_keys

        service_response = service.get_all_states(request_params)

        if service_response[:status] == :ok
          render json: { data: service_response[:data], status: :ok }
        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/cards/create_card
      def create_card
        service = BridgeCardService.new
        recent_card = current_user.cards.order(created_at: :asc).last

        if recent_card.present? && recent_card.card_id.blank?
          meta = recent_card.meta_data.is_a?(Hash) ? recent_card.meta_data : {}
          kyc_status = meta['cardholder_kyc_status'].to_s
          if %w[pending_verification manual_review failed].include?(kyc_status)
            return render json: {
              message: "Cardholder verification is #{kyc_status.tr('_', ' ')}. Complete verification before card creation."
            }, status: :unprocessable_entity
          end
        end

        processed = normalized_card_params

        wt = processed[:wallet_type].to_s.downcase
        wt = 'usd' if wt == 'usdt'

        unless wt == 'usd'
          return render json: { message: 'Cards are available only in Tunnel (USD).' }, status: :unprocessable_entity
        end

        processed[:card_currency] = 'USD'
        processed[:wallet_type] = 'usd'
        card_pin = processed[:card_pin].to_s.strip
        unless card_pin.match?(/\A\d{4}\z/)
          return render json: { message: 'Card PIN must be exactly 4 digits.' }, status: :unprocessable_entity
        end
        processed[:pin] = processed[:card_pin].presence || processed[:pin].presence

        service_response = service.create_card(processed, recent_card)

        if service_response[:status] == :ok
          render json: { data: service_response[:data], message: service_response[:message] }, status: :ok
        else
          Rails.logger.warn("[CardsController] create_card failed message=#{service_response[:message].inspect}")
          render json: { message: service_response[:message] }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/cards/fund_wallet
      def fund_wallet
        service = BridgeCardService.new
        service_response = service.fund_wallet(normalized_card_params, current_user)

        if service_response[:status] == :ok
          render json: { data: service_response[:data], message: service_response[:message], status: :ok }
        else
          render json: { message: service_response[:message], status: :unprocessable_entity }
        end
      end

      # POST /api/v1/cards/unload_wallet
      def unload_wallet
        service = BridgeCardService.new
        service_response = service.unload_wallet(normalized_card_params, current_user)

        if service_response[:status] == :ok
          render json: { data: service_response[:data], message: service_response[:message], status: :ok }
        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/cards/:id/funding_status
      def funding_status
        card = find_user_card!(params[:id])
        return render_provider_missing_card if card.provider_missing?
        return render json: { message: 'card_id not available' }, status: :unprocessable_entity if card.card_id.blank?

        reference = resolve_funding_reference(card)
        return render json: { message: 'transaction reference is required' }, status: :unprocessable_entity if reference.blank?

        local_event = local_funding_event(card:, reference:)
        local_state = normalize_funding_state(local_event&.status)
        provider_state = nil
        provider_payload = nil
        provider_error = nil

        service_response =
          BridgeCardService
          .new
          .get_card_transaction_status(card_id: card.card_id, client_transaction_reference: reference)

        if service_response[:status] == :ok
          provider_payload = service_response[:data].is_a?(Hash) ? service_response[:data] : {}
          provider_state =
            normalize_funding_state(
              provider_payload['status'] || provider_payload['transaction_status'] || provider_payload['state']
            )
        else
          provider_error = service_response[:message]
        end

        effective_state =
          if local_state == 'successful'
            'successful'
          elsif provider_state.present?
            provider_state
          else
            local_state || fallback_funding_state(card:, reference:)
          end
        message =
          case effective_state
          when 'successful'
            'Funding completed.'
          when 'failed'
            'Funding failed.'
          else
            'Funding is being processed.'
          end

        render json: {
          message: message,
          data: {
            card_id: card.id,
            provider_card_id: card.card_id,
            transaction_reference: reference,
            state: effective_state,
            provider_state: provider_state,
            local_state: local_state,
            status: effective_state,
            provider: provider_payload,
            provider_error: provider_error
          }
        }, status: :ok
      end

      # GET /api/v1/cards/:id
      def show
        render json: @card
      end

      # GET /api/v1/cards/:id/details
      def details
        card = find_user_card!(params[:id])
        return render_provider_missing_card if card.provider_missing?
        return render json: { message: 'card_id not available' }, status: :unprocessable_entity if card.card_id.blank?

        service = BridgeCardService.new
        service_response = service.card_details(card.card_id)

        if service_response[:status] == :ok
          render json: { data: service_response[:data], status: :ok }
        elsif provider_missing_error?(service_response[:message])
          mark_card_provider_missing(card, service_response[:message])
          render_provider_missing_card
        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/cards/:id/balance
      def balance
        card = find_user_card!(params[:id])
        return render_provider_missing_card if card.provider_missing?
        return render json: { message: 'card_id not available' }, status: :unprocessable_entity if card.card_id.blank?

        service = BridgeCardService.new
        service_response = service.card_balance(card.card_id)

        if service_response[:status] == :ok
          render json: { data: service_response[:data], status: :ok }
        elsif provider_missing_error?(service_response[:message])
          mark_card_provider_missing(card, service_response[:message])
          render_provider_missing_card
        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/cards/:id/reveal
      def reveal
        render json: { message: 'Method not allowed. Use POST /api/v1/pci/cards/:id/reveal' },
               status: :method_not_allowed
      end

      # GET /api/v1/cards/:id/history
      def history
        card = find_user_card!(params[:id])
        return render json: { message: 'card_id not available' }, status: :unprocessable_entity if card.card_id.blank?

        if params[:refresh].to_s == '1'
          result = Bridgecard::SyncCardTransactions.call(
            card: card,
            page_limit: params[:page_limit]
          )
          Rails.logger.warn("[CardsController] bridgecard sync failed message=#{result[:message]}") if result[:status] != :ok
        end

        txns =
          Transaction
          .joins(:wallet)
          .where(wallets: { user_id: current_user.id })
          .where(bridge_card_id: card.card_id)
          .order(created_at: :desc)

        events =
          CardEvent
          .where(card_id: card.card_id)
          .order(transaction_at: :desc)

        funding_event_refs = successful_funding_event_references(events)

        txn_payload = txns.filter_map do |txn|
          if funding_wallet_transaction?(txn) && funding_event_refs.key?(funding_reference_from_wallet_txn(txn))
            next nil
          end

          metadata = txn.metadata.is_a?(Hash) ? txn.metadata : {}
          {
            id: "txn-#{txn.id}",
            address: txn.address,
            amount: txn.amount,
            status: txn.status,
            created_at: txn.created_at,
            source: 'wallet',
            breakdown: metadata['fee_breakdown']
          }
        end

        event_payload = events.map do |event|
          event_time = event.transaction_at || event.created_at
          label = event.description.presence || event.event.to_s.tr('._', ' ').strip
          metadata = event.metadata.is_a?(Hash) ? event.metadata : {}
          merchant_meta = metadata['merchant'].is_a?(Hash) ? metadata['merchant'] : {}
          normalized_event_amount = bridge_event_amount_usd(event)

          fx_payload =
            if event.merchant_currency.present? || metadata['fx_discovery_present']
              {
                merchant_amount: event.merchant_amount,
                merchant_currency: event.merchant_currency,
                billing_amount: event.billing_amount,
                billing_currency: event.billing_currency,
                fx_implied_rate: event.fx_implied_rate,
                fx_reference_rate: event.fx_reference_rate,
                fx_margin_usd: event.fx_margin_usd
              }.compact
            end

          payload = {
            id: "evt-#{event.id}",
            address: label,
            amount: normalized_event_amount,
            status: event.status,
            created_at: event_time,
            source: 'bridge',
            merchant: {
              name: merchant_meta['name'],
              logo: merchant_meta['logo'],
              website: merchant_meta['website'],
              category: merchant_meta['category'],
              group: merchant_meta['group'],
              city: merchant_meta['city'],
              code: merchant_meta['code'],
              recurring: merchant_meta['recurring']
            }.compact,
            breakdown: {
              principal_usd: metadata['principal_usd'],
              provider_fee_usd: metadata['provider_fee_usd'],
              bitbridge_fee_usd: metadata['bitbridge_fee_usd'],
              fx_markup_usd: metadata['fx_markup_usd'],
              total_debit_usd: metadata['total_debit_usd']
            },
            decline_reason: metadata['decline_reason']
          }

          payload[:fx] = fx_payload if fx_payload.present?
          payload
        end

        combined =
          (txn_payload + event_payload)
          .sort_by { |entry| entry[:created_at] || Time.at(0) }
          .reverse

        render json: combined
      end

      # GET /api/v1/cards/:id/insights
      def insights
        card = find_user_card!(params[:id])
        return render json: { message: 'card_id not available' }, status: :unprocessable_entity if card.card_id.blank?

        txns =
          Transaction
          .joins(:wallet)
          .where(wallets: { user_id: current_user.id })
          .where(bridge_card_id: card.card_id)
          .order(created_at: :desc)

        card_events = CardEvent.where(card_id: card.card_id)
        funding_event_refs = successful_funding_event_references(card_events)

        successful_funding_txns =
          txns
          .where(address: 'Virtual Card Funding (USD)')
          .where(status: Transaction.statuses[:approved])
          .to_a
          .reject { |txn| funding_event_refs.key?(funding_reference_from_wallet_txn(txn)) }

        last_funding_txn =
          successful_funding_txns
          .sort_by(&:created_at)
          .reverse
          .first

        last_credit_event =
          card_events
          .where(card_transaction_type: 'CREDIT')
          .where(status: 'successful')
          .order(transaction_at: :desc)
          .first

        last_funding =
          if last_credit_event && last_funding_txn
            (last_credit_event.transaction_at || last_credit_event.created_at) >
              last_funding_txn.created_at ? last_credit_event : last_funding_txn
          else
            last_credit_event || last_funding_txn
          end

        total_funded_txn =
          successful_funding_txns.sum { |txn| txn.amount.to_d }

        total_funded_events =
          card_events
          .where(card_transaction_type: 'CREDIT')
          .where(status: 'successful')
          .to_a
          .sum { |event| bridge_event_amount_usd(event) || 0.to_d }

        total_funded = total_funded_txn + total_funded_events

        render json: {
          data: {
            last_funding_amount:
              if last_funding.respond_to?(:card_transaction_type)
                bridge_event_amount_usd(last_funding)
              else
                last_funding&.amount
              end,
            last_funding_at: last_funding.respond_to?(:transaction_at) ? last_funding&.transaction_at : last_funding&.created_at,
            total_funded: total_funded,
            history_count: txns.size + card_events.size
          },
          status: :ok
        }
      end

      # PATCH /api/v1/cards/:id/freeze
      def freeze
        card = find_user_card!(params[:id])
        return render_provider_missing_card if card.provider_missing?
        return render json: { message: 'card_id not available' }, status: :unprocessable_entity if card.card_id.blank?

        service = BridgeCardService.new
        service_response = service.freeze_card(card.card_id)

        if service_response[:status] == :ok
          card.update!(status: 'frozen', frozen_by: 'user', frozen_reason: 'User requested freeze')
          render json: { data: service_response[:data], message: service_response[:message], status: :ok }
        elsif provider_missing_error?(service_response[:message])
          mark_card_provider_missing(card, service_response[:message])
          render_provider_missing_card
        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/cards/:id/unfreeze
      def unfreeze
        card = find_user_card!(params[:id])
        return render_provider_missing_card if card.provider_missing?
        return render json: { message: 'card_id not available' }, status: :unprocessable_entity if card.card_id.blank?

        service = BridgeCardService.new
        service_response = service.unfreeze_card(card.card_id)

        if service_response[:status] == :ok
          card.update!(status: 'active', frozen_by: nil, frozen_reason: nil)
          Cards::RiskEngine.reset_declines!(card: card)
          render json: { data: service_response[:data], message: service_response[:message], status: :ok }
        elsif provider_missing_error?(service_response[:message])
          mark_card_provider_missing(card, service_response[:message])
          render_provider_missing_card
        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/cards
      def create
        @card = Card.new(card_params)
        if @card.save
          render json: @card, status: :created
        else
          render json: @card.errors, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/cards/:id
      def update
        if @card.update(card_params)
          render json: @card
        else
          render json: @card.errors, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/cards/:id
      def destroy
        @card.destroy!
        head :no_content
      end

      private

      def process_setup_card_request
        processed = normalized_card_params
        card_pin = processed[:card_pin].to_s.strip
        unless card_pin.match?(/\A\d{4}\z/)
          return setup_error_response(
            code: 'CARD_SETUP_VALIDATION_FAILED',
            message: 'Card PIN must be exactly 4 digits.',
            state: 'failed',
            next_action: 'retry_setup',
            retryable: false,
            status: :unprocessable_entity
          )
        end

        pricing = setup_pricing_payload
        current_card = latest_cardholder_profile_for(current_user)

        if current_card&.card_id.present? && !current_card.provider_missing?
          return setup_success_response(
            message: 'Card already exists for this user.',
            state: 'active',
            next_action: 'none',
            data: {
              card_id: current_card.id,
              provider_card_id: current_card.card_id,
              cardholder_id: current_card.cardholder_id,
              pricing: pricing
            }
          )
        end

        service = BridgeCardService.new
        cardholder = ensure_setup_cardholder!(service: service, processed: processed, current_card: current_card)
        return cardholder if cardholder.is_a?(Hash) && cardholder[:body].present?

        current_card = cardholder
        return pending_cardholder_setup_response(current_card, pricing) unless cardholder_verified?(current_card)

        balance_check = validate_setup_balance(pricing)
        return balance_check if balance_check.present?

        create_payload = processed.merge(
          wallet_type: 'usd',
          currency: 'USD',
          card_currency: 'USD',
          pin: card_pin,
          amount: pricing[:requested_funding_usd]
        )
        create_response = service.create_card(create_payload, current_card)
        if create_response[:status] != :ok
          return setup_error_response(
            code: 'CARD_SETUP_PROVIDER_REJECTED',
            message: create_response[:message].presence || 'Unable to create card.',
            state: 'failed',
            next_action: 'retry_setup',
            retryable: true,
            status: :unprocessable_entity
          )
        end

        card = create_response[:data]
        created = card.present? && card.card_id.present?
        state = created ? 'provider_pending' : 'ready_for_funding'
        next_action = created ? 'wait_webhook' : 'fund_card'

        setup_success_response(
          message: create_response[:message].presence || 'Card setup submitted.',
          state: state,
          next_action: next_action,
          data: {
            card_id: card&.id || current_card.id,
            provider_card_id: card&.card_id,
            cardholder_id: card&.cardholder_id || current_card.cardholder_id,
            pricing: pricing
          }
        )
      end

      def ensure_setup_cardholder!(service:, processed:, current_card:)
        status = cardholder_state_for(current_card)
        return current_card if status == 'verified'
        if %w[pending_verification manual_review].include?(status)
          return current_card
        end

        profile_hash = current_user.user_profile&.attributes&.symbolize_keys || {}
        request_payload =
          current_user.attributes.symbolize_keys
                      .merge(profile_hash)
                      .merge(processed)
        request_payload[:email] ||= request_payload[:email_address].presence || current_user.email
        request_payload[:phone] ||= request_payload[:phone_number].presence
        request_payload[:user_id] ||= current_user.id
        request_payload[:request_id] ||= request.request_id
        request_payload[:phone_number] = normalize_to_e164(request_payload[:phone_number] || request_payload[:phone])
        request_payload[:phone] = request_payload[:phone_number]

        mode = processed[:registration_mode].to_s.casecmp('sync').zero? ? :sync : :async
        registration = service.register_cardholder(request_payload, mode: mode)
        if registration[:status] != :ok
          return setup_error_response(
            code: 'CARD_SETUP_PROVIDER_REJECTED',
            message: registration[:message].presence || 'Unable to submit cardholder profile.',
            state: 'cardholder_failed',
            next_action: 'fix_profile',
            retryable: false,
            status: :unprocessable_entity
          )
        end

        registration[:data] || latest_cardholder_profile_for(current_user)
      end

      def cardholder_verified?(card)
        cardholder_state_for(card) == 'verified'
      end

      def cardholder_state_for(card)
        return '' if card.blank?

        meta = card.meta_data.is_a?(Hash) ? card.meta_data : {}
        meta['cardholder_kyc_status'].to_s.downcase
      end

      def pending_cardholder_setup_response(card, pricing)
        status = cardholder_state_for(card)
        message =
          if status == 'failed'
            'Cardholder verification failed. Update profile details and retry.'
          else
            'Cardholder profile submitted. Waiting for provider verification.'
          end
        state = status == 'failed' ? 'cardholder_failed' : 'cardholder_pending'
        next_action = status == 'failed' ? 'fix_profile' : 'wait_webhook'
        setup_success_response(
          message: message,
          state: state,
          next_action: next_action,
          data: {
            card_id: card&.id,
            provider_card_id: card&.card_id,
            cardholder_id: card&.cardholder_id,
            pricing: pricing,
            cardholder_status: status.presence || 'pending_verification'
          }
        )
      end

      def validate_setup_balance(pricing)
        wallet = current_user.usd_wallet
        if wallet.blank?
          return setup_error_response(
            code: 'CARD_SETUP_VALIDATION_FAILED',
            message: 'USD wallet not found. Activate tunnel first.',
            state: 'failed',
            next_action: 'complete_kyc',
            retryable: false,
            status: :unprocessable_entity
          )
        end

        balance_cents = wallet.balance_cents.to_i
        required_cents = pricing[:required_total_usd_cents].to_i
        return nil if balance_cents >= required_cents

        shortfall = [(required_cents - balance_cents) / 100.0, 0].max
        setup_success_response(
          message: 'Insufficient Tunnel balance for card setup.',
          state: 'insufficient_balance',
          next_action: 'top_up_wallet',
          data: {
            pricing: pricing,
            wallet_balance_usd: (balance_cents / 100.0),
            shortfall_usd: shortfall
          }
        )
      end

      def setup_pricing_payload
        processed =
          begin
            normalized_card_params
          rescue ActionController::ParameterMissing
            {}
          end
        raw_limit = processed[:card_limit].presence || BridgeCardService::DEFAULT_CARD_LIMIT
        normalized_limit = normalize_card_limit_for_setup(raw_limit)
        min_funding_cents =
          BridgeCardService::CARD_MIN_FUNDING_USD_BY_LIMIT.fetch(normalized_limit, BridgeCardService::CARD_ACTIVATION_MIN_USD) * 100
        requested_funding = BigDecimal(processed[:requested_funding_usd].presence || processed[:amount].presence || '0') rescue 0.to_d
        requested_funding_cents = (requested_funding * 100).to_i
        due_now_funding_cents = [requested_funding_cents, 0].max

        fee_cents = FxSetting.current.card_creation_fee_usd_cents.to_i
        fee_cents = (BridgeCardService::CARD_CREATION_FEE_USD * 100).to_i if fee_cents <= 0
        required_total = fee_cents + due_now_funding_cents

        {
          card_limit: normalized_limit.to_s,
          creation_fee_usd: (fee_cents / 100.0),
          min_funding_usd: (min_funding_cents / 100.0),
          requested_funding_usd: (due_now_funding_cents / 100.0),
          required_total_usd: (required_total / 100.0),
          required_total_usd_cents: required_total
        }
      end

      def normalize_card_limit_for_setup(value)
        digits = value.to_s.gsub(/[^0-9]/, '')
        return 1_000_000 if digits == '10000'
        return 1_000_000 if digits == '1000000'

        500_000
      end

      def read_setup_idempotency(idempotency_key)
        raw = Rails.cache.read(setup_idempotency_cache_key(idempotency_key))
        return nil unless raw.is_a?(Hash)

        body = raw[:body].is_a?(Hash) ? raw[:body] : raw['body']
        status = raw[:status].presence || raw['status']
        payload_hash = raw[:payload_hash].presence || raw['payload_hash']
        return nil if body.blank? || status.blank?

        { payload_hash: payload_hash, body: body, status: status }
      rescue StandardError
        nil
      end

      def write_setup_idempotency(idempotency_key, payload_hash:, body:, status:)
        Rails.cache.write(
          setup_idempotency_cache_key(idempotency_key),
          { payload_hash: payload_hash, body: body, status: status },
          expires_in: 24.hours
        )
      rescue StandardError
        nil
      end

      def setup_idempotency_cache_key(idempotency_key)
        "card_setup:idempotency:user:#{current_user.id}:#{idempotency_key}"
      end

      def normalize_to_e164(phone)
        raw = phone.to_s.strip
        digits = phone.to_s.gsub(/\D/, '')
        return raw if digits.blank?

        if digits.start_with?('234') && digits.length == 13
          "+#{digits}"
        elsif digits.start_with?('0') && digits.length == 11
          "+234#{digits[1..]}"
        elsif digits.length == 10
          "+234#{digits}"
        elsif raw.start_with?('+')
          raw
        else
          "+#{digits}"
        end
      end

      def render_setup_success(message:, state:, next_action:, data:)
        payload = {
          success: true,
          message: message,
          state: state,
          next_action: next_action,
          retryable: false,
          retry_after_seconds: 0,
          request_id: request.request_id,
          data: data
        }
        render json: payload, status: :ok
      end

      def render_setup_error(code:, message:, state:, next_action:, retryable:, status:)
        payload = {
          success: false,
          error: code,
          error_code: code,
          message: message,
          state: state,
          next_action: next_action,
          retryable: retryable,
          request_id: request.request_id
        }
        render json: payload, status: status
      end

      def setup_success_response(message:, state:, next_action:, data:)
        {
          body: {
            success: true,
            message: message,
            state: state,
            next_action: next_action,
            retryable: false,
            retry_after_seconds: 0,
            request_id: request.request_id,
            data: data
          },
          status: :ok
        }
      end

      def setup_error_response(code:, message:, state:, next_action:, retryable:, status:)
        {
          body: {
            success: false,
            error: code,
            error_code: code,
            message: message,
            state: state,
            next_action: next_action,
            retryable: retryable,
            request_id: request.request_id
          },
          status: status
        }
      end

      def ensure_bridge_cards_enabled!
        return if FeatureFlags.bridge_cards?

        render json: { message: 'BRIDGE cards are disabled' }, status: :forbidden
      end

      def set_card
        @card = current_user.cards.find(params[:id])
      end

      # ✅ KEY FIX:
      # Timeline often supplies the provider/bridge id (stored in cards.card_id),
      # while REST routes often use cards.id.
      # This lets the same endpoint accept either.
      def find_user_card!(id_param)
        key = id_param.to_s.strip
        raise ActiveRecord::RecordNotFound if key.blank?

        current_user.cards.find_by(id: key) ||
          current_user.cards.find_by(card_id: key) ||
          raise(ActiveRecord::RecordNotFound)
      end

      def card_params
        params.require(:card).permit(
          :cardholder_id, :card_id, :transaction_reference, :card_type, :card_brand,
          :card_currency, :card_limit, :funding_amount, :amount, :currency,
          :requested_funding_usd,
          :transaction_pin, :pin, :card_pin,
          :status, :postal_code, :user_id, :address, :city, :state, :postal,
          :house_no, :bvn, :account_source,
          :wallet_type,
          :first_name, :last_name, :phone, :phone_number, :email_address, :country, :id_type, :selfie_image,
          :id_no, :id_image, :registration_mode,
          :address_line1,
          :email, :limit, :deliveryAddress, :design, :agreeTos,
          meta_data: [:any_key]
        )
      end

      def normalized_card_params
        card_params.to_h.symbolize_keys
      end

      def resolve_funding_reference(card)
        candidates = [
          params[:reference],
          params[:transaction_reference],
          params[:client_transaction_reference]
        ].map { |value| value.to_s.strip.presence }.compact
        return candidates.first if candidates.first.present?

        latest_funding_transaction(card)&.unique_transaction_id
      end

      def latest_funding_transaction(card)
        Transaction
          .joins(:wallet)
          .where(wallets: { user_id: current_user.id })
          .where(bridge_card_id: card.card_id, address: 'Virtual Card Funding (USD)')
          .order(created_at: :desc)
          .first
      end

      def local_funding_event(card:, reference:)
        CardEvent
          .where(card_id: card.card_id)
          .where(card_transaction_type: 'CREDIT')
          .where(
            "provider_transaction_reference = :reference OR transaction_reference = :reference",
            reference: reference
          )
          .order(transaction_at: :desc)
          .first
      end

      def fallback_funding_state(card:, reference:)
        funding_txn =
          Transaction
          .joins(:wallet)
          .where(wallets: { user_id: current_user.id })
          .find_by(
            unique_transaction_id: reference,
            bridge_card_id: card.card_id,
            address: 'Virtual Card Funding (USD)'
          )
        return 'failed' if funding_txn&.failed?

        'pending'
      end

      def normalize_funding_state(raw_status)
        status = raw_status.to_s.strip.downcase
        return nil if status.blank?

        return 'successful' if %w[successful success succeeded approved completed complete].include?(status)
        return 'failed' if %w[failed failure declined error cancelled canceled reversed].include?(status)
        return 'pending' if %w[pending processing queued initiated in_progress].include?(status)

        nil
      end

      def bridge_event_amount_usd(event)
        return nil if event.blank? || event.amount.nil?

        amount = BigDecimal(event.amount.to_s) rescue nil
        return nil if amount.nil?

        currency = event.currency.to_s.upcase
        return amount.to_f unless currency == 'USD'
        return amount.to_f unless amount.frac.zero?

        (amount / 100).to_f
      end

      def successful_funding_event_references(events_relation)
        events = events_relation.respond_to?(:to_a) ? events_relation.to_a : Array(events_relation)
        events.each_with_object({}) do |event, acc|
          next unless event.card_transaction_type.to_s.casecmp('credit').zero?
          next unless event.status.to_s.casecmp('successful').zero?

          ref = funding_reference_from_card_event(event)
          acc[ref] = true if ref.present?
        end
      end

      def funding_reference_from_card_event(event)
        event.provider_transaction_reference.presence ||
          event.transaction_reference.presence
      end

      def funding_reference_from_wallet_txn(txn)
        metadata = txn.metadata.is_a?(Hash) ? txn.metadata : {}
        metadata['provider_transaction_reference'].presence ||
          metadata['transaction_reference'].presence ||
          txn.unique_transaction_id.presence
      end

      def funding_wallet_transaction?(txn)
        metadata = txn.metadata.is_a?(Hash) ? txn.metadata : {}
        subtype = metadata['subtype'].to_s.downcase

        txn.address.to_s.casecmp('Virtual Card Funding (USD)').zero? ||
          subtype.include?('virtual_card_funding') ||
          subtype.include?('card_fund')
      end

      def latest_cardholder_profile_for(user)
        return nil if user.blank?

        user
          .cards
          .where.not(cardholder_id: [nil, ''])
          .order(created_at: :desc)
          .first
      end

      def provider_missing_error?(message)
        normalized = message.to_s.downcase
        normalized.include?('invalid card id') ||
          normalized.include?("there's no card with this id") ||
          normalized.include?('card not found')
      end

      def mark_card_provider_missing(card, provider_message)
        card.mark_provider_missing!(provider_message: provider_message)
      rescue StandardError => e
        Rails.logger.warn("[CardsController] provider_missing_mark_failed card=#{card&.id} message=#{e.message}")
      end

      def render_provider_missing_card
        render json: {
          message: 'Card is no longer available. Please create a new card.',
          code: 'CARD_PROVIDER_MISSING'
        }, status: :not_found
      end
    end
  end
end
