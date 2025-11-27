# frozen_string_literal: true

module Api
  module V1
    class CardsController < ApplicationController
      before_action :set_card, only: %i[show update destroy]

      # GET /cards
      def index
        @cards = Card.all

        render json: @cards
      end

      def fund_wallet
        service = BridgeCardService.new

        service_response = service.fund_wallet(card_params)

        if service_response[:status] == :ok
          render json: { data: service_response[:data], message: service_response[:message], status: :ok }

        else
          render json: { message: service_response[:message], status: :unprocessable_entity }

        end
      end

      def user_card
        card = current_user.cards.last
        render json: { data: card, status: :ok }
      end

      def register_cardholder
        service = BridgeCardService.new

        proccessed_card_params = current_user.attributes.symbolize_keys.merge(card_params.to_h.symbolize_keys).merge(current_user.user_profile.attributes.symbolize_keys)
        service_response = service.register_cardholder_synchronously(proccessed_card_params)
        if service_response[:status] == :ok
          render json: { data: service_response[:data], message: service_response[:message] }, status: :ok

        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity

        end
      end

      def create_card
        service = BridgeCardService.new

        recent_card = current_user.cards.last
        proccessed_card_params = card_params.to_h.symbolize_keys
        service_response = service.create_card(proccessed_card_params, recent_card)
        if service_response[:status] == :ok
          render json: { data: service_response[:data], message: service_response[:message] }, status: :ok

        else
          render json: { message: service_response[:message] }, status: :unprocessable_entity

        end
      end

      # GET /cards/1
      def show
        render json: @card
      end

      # POST /cards
      def create
        @card = Card.new(card_params)

        return unless @card.save

        render json: @card, status: :created
        render json: @card.errors, status: :unprocessable_entity
      end

      # PATCH/PUT /cards/1
      def update
        if @card.update(card_params)
          render json: @card
        else
          render json: @card.errors, status: :unprocessable_entity
        end
      end

      # DELETE /cards/1
      def destroy
        @card.destroy!
      end

      private

      # Use callbacks to share common setup or constraints between actions.
      def set_card
        @card = Card.find(params[:id])
      end

      # Only allow a list of trusted parameters through.
      def card_params
        params.require(:card).permit(:cardholder_id, :card_id, :transaction_reference, :card_type, :card_brand,
                                     :card_currency, :card_limit, :funding_amount, :amount, :pin, :status, :postal_code, :user_id, :address, :city, :state, :postal, :house_no, :bvn, :account_source)
      end
    end
  end
end
