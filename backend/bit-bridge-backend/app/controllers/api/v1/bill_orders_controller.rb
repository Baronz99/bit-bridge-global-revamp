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
        @bill_orders = BillOrder.all
        render json: { data: ActiveModelSerializers::SerializableResource.new(@bill_orders) }, status: :ok
      end

      def recent
        @bill_orders = BillOrder.select(:amount).distinct.order(created_at: :desc).limit(3)
        render json: { data: ActiveModelSerializers::SerializableResource.new(@bill_orders) }, status: :ok
      end

      def initialize_confirm_payment
        payment_method = params[:payment_method]
        redirect_url = params[:redirect_url]
        use_commission = params[:use_commission] || false

        if payment_method == 'card'
          if @bill_order.payment_method != 'card' && @bill_order.initialized?
            @bill_order.update(payment_method: :card)
          end

          service = PaymentService.new
          service_response = service.init_transaction(@bill_order.attributes.symbolize_keys.merge({ type: 'bills',
                                                                                                    payment_method: 'card', redirect_url: redirect_url, use_commission: use_commission }))

          status = service_response&.dig(:status)
          payment_reference = service_response&.dig(:response, 'responseBody', 'paymentReference')

          if status == :ok && payment_reference.present?
            transaction_record = TransactionRecord.new(bill_order_id: @bill_order.id, reference: payment_reference)

            if transaction_record.save

              render json: service_response[:response], status: :ok
            else
              render json: { message: transaction_record.errors.full_messages.to_sentence }

            end

          elsif status.nil? || payment_reference.nil?
            render json: { success: false, status: 'pending', message: 'Payment pending...' }, status: :service_unavailable
          else
            render json: { message: service_response&.dig(:message) || 'Payment initialization failed' }, status: :unprocessable_entity

          end
        else
          confirm_payment(payment_method)

        end
      end

      def confirm_bill_payment
        payment_method = bill_order_params[:payment_method]

        use_commission = ActiveModel::Type::Boolean.new.cast(bill_order_params[:use_commission])
        idempotency_key = request.headers['Idempotency-Key'].to_s.strip

        if idempotency_key.present?
          existing = current_user.bill_orders.find_by(idempotency_key: idempotency_key)
          if existing && existing.id != @bill_order.id
            return render json: {
              success: existing.completed?,
              data: existing,
              message: existing.completed? ? 'payment confirmed' : 'payment processing'
            }, status: :ok
          end
        end

        service = BuyPowerPaymentService.new
        service_response =
          service.confirm_subscription(
            @bill_order,
            payment_method,
            use_commission,
            request_id: request.request_id,
            idempotency_key: idempotency_key
          )
        case service_response[:status]
        when 'success'
          render json: { success: true, data: service_response[:response], message: 'payment confirmed' }, status: :ok
        when 'pending'
          render json: { success: false, status: 'pending', message: service_response[:response] }, status: :accepted
        else
          render json: { success: false, message: service_response[:response] }, status: :unprocessable_entity
        end
      end

      def user
        bill_orders = current_user.bill_orders.where(status: %w[completed declined])
        # bill_orders = current_user.bill_orders.where(status: "completed")
        render json: { data: ActiveModelSerializers::SerializableResource.new(bill_orders) }, status: :ok
      end

      def user_recent
        bill_orders = current_user.bill_orders.where(status: 'completed').order(created_at: :desc)
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
        render json: { data: BillOrderSerializer.new(@bill_order) }, status: :ok
      end

      # POST /bill_orders
      def create
        @bill_order = BillOrder.new(bill_order_params)

        if @bill_order.save
          render json: @bill_order, status: :created, location: @bill_order
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
    end
  end
end
