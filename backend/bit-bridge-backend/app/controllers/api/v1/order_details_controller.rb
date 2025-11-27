# frozen_string_literal: true

module Api
  module V1
    class OrderDetailsController < ApplicationController
      before_action :set_order_detail, only: %i[show update destroy]

      # GET /order_details
      def index
        @order_details = OrderDetail.all.order(created_at: :desc)
        render json: { data: ActiveModelSerializers::SerializableResource.new(@order_details) }, status: :ok
      end

      def user
        @order_details = current_user.order_details
        render json: { data: ActiveModelSerializers::SerializableResource.new(@order_details) }, status: :ok
      end

      # GET /order_details/1
      def show
        render json: { data: OrderDetailSerializer.new(@order_detail) }, status: :ok
      end

      # POST /order_details
      def create
        # Rails.logger.debug(order_detail_params.inspect)

        @order_detail = current_user.order_details.new(order_detail_params)

        if @order_detail.save
          # Rails.logger.debug(@order_detail.errors.full_messages)

          render json: { data: OrderDetailSerializer.new(@order_detail), message: 'Order created' }, status: :created
          # render json: {data: OrderDetailSerializer.new(@order_detail), message: "Order created" }, status: :created

        else
          render json: { message: @order_detail.errors.full_messages.to_sentence }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /order_details/1
      def update
        if @order_detail.update(order_detail_params)
          render json: @order_detail
        else
          render json: @order_detail.errors, status: :unprocessable_entity
        end
      end

      # DELETE /order_details/1
      def destroy
        @order_detail.destroy!
      end

      private

      # Use callbacks to share common setup or constraints between actions.
      def set_order_detail
        @order_detail = OrderDetail.includes(order_items: %i[card_token provision product]).find(params[:id])
      end

      # Only allow a list of trusted parameters through.
      def order_detail_params
        params.require(:order_detail).permit(:total_amount, :extra_info, :status, :payment_method, :viewed, :net_total,
                                             :order_type, :proof, order_items_attributes: %i[quantity amount provision_id product_id currency])
      end
    end
  end
end
