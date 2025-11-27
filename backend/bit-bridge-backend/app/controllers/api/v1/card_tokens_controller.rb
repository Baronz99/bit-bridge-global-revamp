# frozen_string_literal: true

module Api
  module V1
    class CardTokensController < ApplicationController
      before_action :set_card_token, only: %i[show update destroy]

      # GET /card_tokens
      def index
        @card_tokens = CardToken.all
        render json: { data: ActiveModelSerializers::SerializableResource.new(@card_tokens) }
      end

      def user
        @card_tokens = current_user.card_tokens

        render json: { data: ActiveModelSerializers::SerializableResource.new(@card_tokens) }
      end

      # GET /card_tokens/1
      def show
        render json: @card_token
      end

      # POST /card_tokens
      def create
        @card_token = CardToken.new(card_token_params)

        if @card_token.save
          render json: { data: @card_token, message: 'Gift Card Token sent' }, status: :created
        else
          render json: { message: @card_token.errors.full_messages.to_sentence }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /card_tokens/1
      def update
        if @card_token.update(card_token_params)
          render json: @card_token
        else
          render json: @card_token.errors, status: :unprocessable_entity
        end
      end

      # DELETE /card_tokens/1
      def destroy
        @card_token.destroy!
      end

      private

      # Use callbacks to share common setup or constraints between actions.
      def set_card_token
        @card_token = CardToken.find(params[:id])
      end

      # Only allow a list of trusted parameters through.
      def card_token_params
        params.require(:card_token).permit(:reveal, :order_item_id, :token)
      end
    end
  end
end
