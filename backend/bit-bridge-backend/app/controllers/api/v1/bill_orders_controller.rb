# frozen_string_literal: true

# require 'set'

module Api
  module V1
    class BillOrdersController < ApplicationController
      before_action :set_bill_order, only: %i[show update destroy initialize_confirm_payment confirm_bill_payment]
      before_action :disable_client_cache, only: %i[initialize_confirm_payment]
      after_action :strip_cache_validators, only: %i[initialize_confirm_payment]

      # GET /bill_orders
      def index
        @bill_orders = BillOrder.includes(:transaction_record)
        render json: { data: ActiveModelSerializers::SerializableResource.new(@bill_orders) }, status: :ok
      end

      def recent
        @bill_orders = BillOrder.includes(:transaction_record).select(:amount).distinct.order(created_at: :desc).limit(3)
        render json: { data: ActiveModelSerializers::SerializableResource.new(@bill_orders) }, status: :ok
      end

      def initialize_confirm_payment
        payment_method = params[:payment_method].to_s.presence || 'wallet'
        if payment_method != 'wallet'
          return render json: {
            success: false,
            error_code: 'WALLET_ONLY_BILLS',
            message: 'Bills can only be paid from wallet. Please fund wallet first.'
          }, status: :unprocessable_entity
        end

        intent = bill_payment_intent_for(@bill_order)
        @bill_order.update(payment_method: :wallet) unless @bill_order.payment_method == 'wallet'

        render json: {
          success: true,
          message: 'Bill payment intent ready',
          data: BillOrderSerializer.new(@bill_order),
          intent: intent_payload(intent)
        }, status: :ok
      end

      def confirm_bill_payment
        payment_method = bill_order_params[:payment_method].to_s.presence || 'wallet'
        if payment_method != 'wallet'
          return render json: {
            success: false,
            error_code: 'WALLET_ONLY_BILLS',
            message: 'Bills can only be paid from wallet. Please fund wallet first.'
          }, status: :unprocessable_entity
        end

        intent = resolve_intent_for_confirm(@bill_order)
        @bill_order.update(use_commission: ActiveModel::Type::Boolean.new.cast(bill_order_params[:use_commission]))

        result = Bills::ExecuteIntent.call(intent: intent, request_id: request.request_id)
        body = result[:body].merge(data: BillOrderSerializer.new(@bill_order.reload))
        render json: body, status: result[:http_status]
      end

      def user
        bill_orders = current_user.bill_orders.includes(:transaction_record).where(status: %w[completed declined])
        # bill_orders = current_user.bill_orders.where(status: "completed")
        render json: { data: ActiveModelSerializers::SerializableResource.new(bill_orders) }, status: :ok
      end

      def user_recent
        bill_orders = current_user.bill_orders.includes(:transaction_record).where(status: 'completed').order(created_at: :desc)
        unique_orders = []

        seen_amounts = Set.new

        bill_orders.each do |order|
          next if seen_amounts.include?(order.amount)

          unique_orders << order
          seen_amounts.add(order.amount)
        end

        # unique_amounts = bill_orders.map(&:amount).uniq.first(3)

        render json: { data: unique_orders.first(3) }, status: :ok
      end

      # GET /bill_orders/1
      def show
        @bill_order = BillOrder.includes(:transaction_record).find(@bill_order.id)
        render json: { data: BillOrderSerializer.new(@bill_order) }, status: :ok
      end

      # POST /bill_orders
      def create
        @bill_order = BillOrder.new(bill_order_params)

        if @bill_order.save
          intent = bill_payment_intent_for(@bill_order)
          render json: {
            data: BillOrderSerializer.new(@bill_order),
            intent: intent_payload(intent)
          }, status: :created, location: @bill_order
        else
          render json: @bill_order.errors, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /bill_orders/1
      def update
        if @bill_order.update(bill_order_params)
          render json: @bill_order
        else
          render json: @bill_order.errors, status: :unprocessable_entity
        end
      end

      # DELETE /bill_orders/1
      def destroy
        @bill_order.destroy!
      end

      private

      def disable_client_cache
        expires_now
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        response.cache_control.clear
      end

      def strip_cache_validators
        response.headers.delete('ETag')
        response.headers.delete('Last-Modified')
      end

      # Use callbacks to share common setup or constraints between actions.
      def set_bill_order
        @bill_order = BillOrder.find(params[:id])
      end

      def confirm_payment(payment_method)
        service = BuyPowerPaymentService.new
        service_response = service.confirm_subscription(@bill_order, payment_method, false, request_id: request.request_id)
        status = service_response&.dig(:status)

        if status.nil?
          render json: { success: false, status: 'pending', message: 'Payment pending...' }, status: :service_unavailable
          return
        end

        case status
        when 'success'
          render json: { success: true, data: service_response&.dig(:response), message: 'payment confirmed' }, status: :ok
        when 'pending'
          render json: { success: false, status: 'pending', message: service_response&.dig(:response) || 'Payment pending. Please try again.' }, status: :service_unavailable
        when 'error'
          message = service_response&.dig(:response) || service_response&.dig(:message) || 'Payment confirmation failed'
          render json: { success: false, message: message }, status: :unprocessable_entity
        else
          render json: { success: false, status: 'pending', message: 'Payment pending...' }, status: :service_unavailable
        end
      end

      # Only allow a list of trusted parameters through.
      def bill_order_params
        params.require(:bill_order).permit(:status, :meter_number, :amount, :meter_type, :phone, :service_type, :use_commission,
                                           :payment_type, :email, :tariff_class, :description, :name, :payment_method, :redirect_url)
      end

      def bill_payment_intent_for(bill_order)
        BillPaymentIntent.find_or_create_for_bill_order!(bill_order: bill_order)
      end

      def resolve_intent_for_confirm(bill_order)
        intent_id = params[:intent_id].presence || params.dig(:bill_order, :intent_id).presence
        return current_user.bill_payment_intents.find(intent_id) if intent_id.present?

        bill_payment_intent_for(bill_order)
      end

      def intent_payload(intent)
        intent.as_json(only: %i[id bill_order_id bill_type amount fee total status provider_reference expires_at created_at updated_at])
      end
    end
  end
end
