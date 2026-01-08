# frozen_string_literal: true

module Api
  module V1
    class CardsController < ApplicationController
      # NOTE: ApplicationController already has authenticate_user!
      # Keeping this would be redundant, so we omit it.

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

      rescue_from ActiveRecord::RecordNotFound do
        render json: { message: 'Card not found' }, status: :not_found
      end

      rescue_from StandardError do |e|
        # Don’t hide errors in development, but don’t return raw exception messages in prod.
        Rails.logger.error("[CardsController] #{e.class}: #{e.message}\n#{e.backtrace&.first(10)&.join("\n")}")

        render json: { message: 'Something went wrong while processing your request.' },
               status: :internal_server_error
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
      #
      # Body example:
      # { card: { amount: 10, transaction_pin: "1234", wallet_type: "usd", ... } }
      def create_card
        raw_pin =
          params.dig(:card, :transaction_pin).presence ||
          params.dig(:card, :pin).presence ||
          ''

        return unless require_transaction_pin!(raw_pin)

        service = BridgeCardService.new
        recent_card = current_user.cards.order(created_at: :asc).last

        processed = normalized_card_params

        # ✅ Tunnel-only: cards are USD feature
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
        card = current_user.cards.find(params[:id])
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
        card = current_user.cards.find(params[:id])
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
      #
      # IMPORTANT:
      # You intentionally disabled this endpoint earlier.
      # Keep it disabled to avoid leaking PCI data through non-PCI controller.
      def reveal
        render json: { message: 'Method not allowed. Use POST /api/v1/pci/cards/:id/reveal' },
               status: :method_not_allowed
      end

      # GET /api/v1/cards/:id/history
      def history
        card = current_user.cards.find(params[:id])
        return render json: { message: 'card_id not available' }, status: :unprocessable_entity if card.card_id.blank?

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
          {
            id: "txn-#{txn.id}",
            address: txn.address,
            amount: txn.amount,
            status: txn.status,
            created_at: txn.created_at,
            source: 'wallet'
          }
        end

        event_payload = events.map do |event|
          event_time = event.transaction_at || event.created_at
          label = event.description.presence || event.event.to_s.tr('._', ' ').strip

          {
            id: "evt-#{event.id}",
            address: label,
            amount: event.amount,
            status: event.status,
            created_at: event_time,
            source: 'bridge'
          }
        end

        combined =
          (txn_payload + event_payload)
          .sort_by { |entry| entry[:created_at] || Time.at(0) }
          .reverse

        render json: combined
      end

      # GET /api/v1/cards/:id/insights
      def insights
        card = current_user.cards.find(params[:id])
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
        card = current_user.cards.find(params[:id])
        return render json: { message: 'card_id not available' }, status: :unprocessable_entity if card.card_id.blank?

        service = BridgeCardService.new
        service_response = service.freeze_card(card.card_id)

        if service_response[:status] == :ok
          render json: { data: service_response[:data], message: service_response[:message], status: :ok }
        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/cards/:id/unfreeze
      def unfreeze
        card = current_user.cards.find(params[:id])
        return render json: { message: 'card_id not available' }, status: :unprocessable_entity if card.card_id.blank?

        service = BridgeCardService.new
        service_response = service.unfreeze_card(card.card_id)

        if service_response[:status] == :ok
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
        # Avoid letting a user access someone else’s card
        @card = current_user.cards.find(params[:id])
      end

      def card_params
        params.require(:card).permit(
          :cardholder_id, :card_id, :transaction_reference, :card_type, :card_brand,
          :card_currency, :card_limit, :funding_amount, :amount, :currency,
          :transaction_pin, # ✅ keep ONLY transaction_pin coming from client
          :status, :postal_code, :user_id, :address, :city, :state, :postal,
          :house_no, :bvn, :account_source,
          :wallet_type,
          :first_name, :last_name, :phone, :email_address, :country, :id_type, :selfie_image,
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
