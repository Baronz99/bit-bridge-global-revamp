# frozen_string_literal: true

module Api
  module V1
    class CardsController < ApplicationController
      before_action :set_card, only: %i[show update destroy]

      before_action :ensure_bridge_cards_enabled!,
                    only: %i[
                      register_cardholder
                      create_card
                      get_all_states
                      fund_wallet
                      unload_wallet
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
                      register_cardholder
                      create_card
                      fund_wallet
                      unload_wallet
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
        card = current_user.cards.order(created_at: :asc).last
        render json: { data: card, status: :ok }
      end

      # POST /api/v1/cards/register_cardholder
      def register_cardholder
        service = BridgeCardService.new

        profile_hash = current_user.user_profile&.attributes&.symbolize_keys || {}

        processed =
          current_user.attributes.symbolize_keys
                      .merge(profile_hash)
                      .merge(card_params.to_h.symbolize_keys)

        processed[:email] ||= processed[:email_address].presence || current_user.email
        processed[:phone] ||= processed[:phone_number].presence

        service_response = service.register_cardholder_synchronously(processed)

        if service_response[:status] == :ok
          render json: { data: service_response[:data], message: service_response[:message] }, status: :ok
        else
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
        raw_pin =
          params.dig(:card, :transaction_pin).presence ||
          params.dig(:card, :pin).presence ||
          ''

        return unless require_transaction_pin!(raw_pin)

        service = BridgeCardService.new
        recent_card = current_user.cards.order(created_at: :asc).last

        processed = normalized_card_params

        wt = processed[:wallet_type].to_s.downcase
        wt = 'usd' if wt == 'usdt'

        unless wt == 'usd'
          return render json: { message: 'Cards are available only in Tunnel (USD).' }, status: :unprocessable_entity
        end

        processed[:card_currency] = 'USD'
        processed[:wallet_type] = 'usd'

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
        raw_pin =
          params.dig(:card, :transaction_pin).presence ||
          params.dig(:card, :pin).presence ||
          ''

        return unless require_transaction_pin!(raw_pin)

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
        raw_pin =
          params.dig(:card, :transaction_pin).presence ||
          params.dig(:card, :pin).presence ||
          ''

        return unless require_transaction_pin!(raw_pin)

        service = BridgeCardService.new
        service_response = service.unload_wallet(normalized_card_params, current_user)

        if service_response[:status] == :ok
          render json: { data: service_response[:data], message: service_response[:message], status: :ok }
        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/cards/:id
      def show
        render json: @card
      end

      # GET /api/v1/cards/:id/details
      def details
        card = find_user_card!(params[:id])
        return render json: { message: 'card_id not available' }, status: :unprocessable_entity if card.card_id.blank?

        service = BridgeCardService.new
        service_response = service.card_details(card.card_id)

        if service_response[:status] == :ok
          render json: { data: service_response[:data], status: :ok }
        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/cards/:id/balance
      def balance
        card = find_user_card!(params[:id])
        return render json: { message: 'card_id not available' }, status: :unprocessable_entity if card.card_id.blank?

        service = BridgeCardService.new
        service_response = service.card_balance(card.card_id)

        if service_response[:status] == :ok
          render json: { data: service_response[:data], status: :ok }
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

        txn_payload = txns.map do |txn|
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
            amount: event.amount,
            status: event.status,
            created_at: event_time,
            source: 'bridge',
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

        last_funding_txn =
          txns
          .where(address: 'Virtual Card Funding (USD)')
          .where(status: Transaction.statuses[:approved])
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
          txns
          .where(address: 'Virtual Card Funding (USD)')
          .where(status: Transaction.statuses[:approved])
          .sum(:amount)

        total_funded_events =
          card_events
          .where(card_transaction_type: 'CREDIT')
          .where(status: 'successful')
          .sum(:amount)

        total_funded = total_funded_txn + total_funded_events

        render json: {
          data: {
            last_funding_amount: last_funding&.amount,
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
        return render json: { message: 'card_id not available' }, status: :unprocessable_entity if card.card_id.blank?

        service = BridgeCardService.new
        service_response = service.freeze_card(card.card_id)

        if service_response[:status] == :ok
          card.update!(status: 'frozen', frozen_by: 'user', frozen_reason: 'User requested freeze')
          render json: { data: service_response[:data], message: service_response[:message], status: :ok }
        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/cards/:id/unfreeze
      def unfreeze
        card = find_user_card!(params[:id])
        return render json: { message: 'card_id not available' }, status: :unprocessable_entity if card.card_id.blank?

        service = BridgeCardService.new
        service_response = service.unfreeze_card(card.card_id)

        if service_response[:status] == :ok
          card.update!(status: 'active', frozen_by: nil, frozen_reason: nil)
          Cards::RiskEngine.reset_declines!(card: card)
          render json: { data: service_response[:data], message: service_response[:message], status: :ok }
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
          :transaction_pin,
          :status, :postal_code, :user_id, :address, :city, :state, :postal,
          :house_no, :bvn, :account_source,
          :wallet_type,
          :first_name, :last_name, :phone, :phone_number, :email_address, :country, :id_type, :selfie_image,
          :address_line1,
          :email, :limit, :deliveryAddress, :design, :agreeTos,
          meta_data: [:any_key]
        )
      end

      def normalized_card_params
        card_params.to_h.symbolize_keys
      end
    end
  end
end
