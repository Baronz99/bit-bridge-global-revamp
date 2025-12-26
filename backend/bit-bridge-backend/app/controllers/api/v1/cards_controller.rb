# frozen_string_literal: true

module Api
  module V1
    class CardsController < ApplicationController
      before_action :authenticate_user!
      before_action :set_card, only: %i[show update destroy]

      # GET /api/v1/cards
      def index
        @cards = current_user.cards

        render json: @cards
      end

      # POST /api/v1/cards/fund_wallet
      def fund_wallet
        service = BridgeCardService.new
        service_response = service.fund_wallet(normalized_card_params)

        if service_response[:status] == :ok
          render json: { data: service_response[:data], message: service_response[:message], status: :ok }
        else
          render json: { message: service_response[:message], status: :unprocessable_entity }
        end
      end

      # GET /api/v1/cards/user_card
      def user_card
        card = current_user.cards.last
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

      # GET /api/v1/cards/get_all_states
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
      # Body:
      # { card: { amount: 10, transaction_pin: "1234", card_currency: "USD", wallet_type: "usd", ... } }
      def create_card
        raw_pin =
          params.dig(:card, :transaction_pin).presence ||
          params.dig(:card, :pin).presence ||
          ''

        # 🔐 PIN gate (expects require_transaction_pin! in ApplicationController)
        return unless require_transaction_pin!(raw_pin)

        service = BridgeCardService.new
        recent_card = current_user.cards.last

        processed = normalized_card_params

        # ✅ Tunnel-only: cards are USD feature
wt = processed[:wallet_type].to_s.downcase
wt = 'usd' if wt == 'usdt'
unless wt == 'usd'
  return render json: { message: 'Cards are available only in Tunnel (USD).' }, status: :unprocessable_entity
end

processed[:card_currency] = 'USD'
processed[:wallet_type] = 'usd'


        # ✅ enforce USD if wallet_type is usd
        if processed[:wallet_type].to_s.downcase == 'usd'
          processed[:card_currency] = 'USD'
        end

        service_response = service.create_card(processed, recent_card)

        if service_response[:status] == :ok
          render json: { data: service_response[:data], message: service_response[:message] }, status: :ok
        else
          if defined?(Rails) && Rails.logger
            Rails.logger.warn(
              "[CardsController] create_card failed message=#{service_response[:message].inspect}"
            )
          end
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
      def reveal
        card = current_user.cards.find(params[:id])
        return render json: { message: 'card_id not available' }, status: :unprocessable_entity if card.card_id.blank?

        service = BridgeCardService.new
        service_response = service.card_details_reveal(card.card_id)

        if service_response[:status] == :ok
          render json: { data: service_response[:data], status: :ok }
        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity
        end
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
      end

      private

      def set_card
        @card = Card.find(params[:id])
      end

      def card_params
        params.require(:card).permit(
          :cardholder_id, :card_id, :transaction_reference, :card_type, :card_brand,
          :card_currency, :card_limit, :funding_amount, :amount,
          :pin, :transaction_pin,
          :status, :postal_code, :user_id, :address, :city, :state, :postal,
          :house_no, :bvn, :account_source,
          :wallet_type,
          :first_name, :last_name, :phone, :email_address, :country, :id_type, :selfie_image,
          :email, :limit, :deliveryAddress, :design, :agreeTos,
          meta_data: [:any_key]
        )
      end

      def normalized_card_params
        h = card_params.to_h.symbolize_keys

        # Map transaction_pin to pin for any legacy service that expects :pin
        if h[:transaction_pin].present? && h[:pin].blank?
          h[:pin] = h[:transaction_pin]
        end

        h
      end
    end
  end
end
