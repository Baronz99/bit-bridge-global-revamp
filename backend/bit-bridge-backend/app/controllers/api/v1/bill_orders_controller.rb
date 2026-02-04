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
            transaction_record = TransactionRecord.new(
              bill_order_id: @bill_order.id,
              reference: payment_reference,
              status: 'pending',
              event_type: 'bill_order.checkout_init'
            )

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

        request_tag = "request_id=#{request.request_id} bill_order_id=#{@bill_order&.id} status=#{@bill_order&.status} biller=#{@bill_order&.biller} amount=#{@bill_order&.amount}"

        if idempotency_key.present?
          existing = current_user.bill_orders.find_by(idempotency_key: idempotency_key)
          if existing && existing.id != @bill_order.id
            status_value = existing.completed? ? 'success' : 'pending'
            return render json: confirm_payload(
              bill_order: existing,
              status: status_value,
              success: existing.completed?,
              message: existing.completed? ? 'payment confirmed' : 'payment processing'
            ), status: :ok
          end
        end

        Rails.logger.info("[ConfirmBillOrder] start #{request_tag} payment_method=#{payment_method} use_commission=#{use_commission} idempotency_key_present=#{idempotency_key.present?}")

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
          render json: confirm_payload(
            bill_order: service_response[:response],
            status: 'success',
            success: true,
            message: 'payment confirmed'
          ), status: :ok
        when 'pending'
          render json: confirm_payload(
            bill_order: @bill_order,
            status: 'pending',
            success: false,
            message: service_response[:response] || 'Payment processing...'
          ), status: :accepted
        else
          raw_message = service_response[:message] || service_response[:response] || 'Payment confirmation failed'
          message = normalize_meter_error(@bill_order&.service_type, raw_message)
          code = service_response[:code].to_i
          status_symbol = service_response[:status].to_s

          if code == 503
            Rails.logger.warn("[ConfirmBillOrder] provider_unavailable #{request_tag} message=#{message}")
            render json: confirm_payload(
              bill_order: @bill_order,
              status: 'pending',
              success: false,
              message: "Provider temporarily unavailable. Try again. Reference: #{request.request_id}"
            ), status: :service_unavailable
          elsif status_symbol == 'error'
            Rails.logger.warn("[ConfirmBillOrder] error #{request_tag} message=#{message}")
            render json: confirm_payload(
              bill_order: @bill_order,
              status: 'failed',
              success: false,
              message: message
            ), status: :unprocessable_entity
          else
            Rails.logger.warn("[ConfirmBillOrder] unexpected_status #{request_tag} status=#{service_response[:status]} message=#{message}")
            render json: confirm_payload(
              bill_order: @bill_order,
              status: 'failed',
              success: false,
              message: message
            ), status: :unprocessable_entity
          end
        end
      rescue ActiveRecord::RecordNotFound => e
        Rails.logger.warn("[ConfirmBillOrder] not_found #{request_tag} error=#{e.message}")
        render json: confirm_payload(
          bill_order: nil,
          status: 'failed',
          success: false,
          message: 'Bill order not found'
        ), status: :not_found
      rescue StandardError => e
        Rails.logger.error("[ConfirmBillOrder] exception #{request_tag} error=#{e.class} message=#{e.message} backtrace=#{e.backtrace&.take(5)&.join(' | ')}")
        render json: confirm_payload(
          bill_order: @bill_order,
          status: 'failed',
          success: false,
          message: "Confirm failed. Reference: #{request.request_id}"
        ), status: :unprocessable_entity
      end

      def normalize_meter_error(service_type, message)
        return message unless message.to_s.downcase.include?('meter')
        type = service_type.to_s.strip.upcase
        return 'Phone number is required' if %w[VTU DATA].include?(type)
        message
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
          render json: confirm_payload(
            bill_order: @bill_order,
            status: 'pending',
            success: false,
            message: 'Payment pending...'
          ), status: :service_unavailable
          return
        end

        case status
        when 'success'
          render json: confirm_payload(
            bill_order: service_response&.dig(:response),
            status: 'success',
            success: true,
            message: 'payment confirmed'
          ), status: :ok
        when 'pending'
          render json: confirm_payload(
            bill_order: @bill_order,
            status: 'pending',
            success: false,
            message: service_response&.dig(:response) || 'Payment pending. Please try again.'
          ), status: :service_unavailable
        when 'error'
          message = service_response&.dig(:response) || service_response&.dig(:message) || 'Payment confirmation failed'
          render json: confirm_payload(
            bill_order: @bill_order,
            status: 'failed',
            success: false,
            message: message
          ), status: :unprocessable_entity
        else
          render json: confirm_payload(
            bill_order: @bill_order,
            status: 'pending',
            success: false,
            message: 'Payment pending...'
          ), status: :service_unavailable
        end
      end

      # Only allow a list of trusted parameters through.
      def bill_order_params
        params.require(:bill_order).permit(:status, :meter_number, :amount, :meter_type, :phone, :service_type, :use_commission,
                                           :payment_type, :email, :tariff_class, :description, :name, :payment_method, :redirect_url)
      end

      def confirm_payload(bill_order:, status:, success:, message:)
        order_id = bill_order&.id
        reference =
          bill_order&.provider_reference.presence ||
          bill_order&.transaction_id.presence ||
          bill_order&.idempotency_key.presence ||
          order_id

        {
          success: success,
          status: status,
          message: message,
          data: bill_order,
          bill_order_id: order_id,
          ui: {
            next_screen: 'transaction_details',
            order_id: order_id,
            reference: reference,
            poll: status == 'pending',
            poll_interval_ms: 5000
          }
        }
      end
    end
  end
end
