# frozen_string_literal: true

module Api
  module V1
    class PaymentProcessorsController < ApplicationController
      before_action :set_bill_order, only: %i[show confirm_payment repurchase query_transaction]
      skip_before_action :authenticate_user!, only: %i[get_ref_order]
      def verify_meter
        service = BuyPowerPaymentService.new
        service.verify_meter(verify_processor_params)
      end

      def show
        render json: { data: BillOrderSerializer.new(@bill_order) }
      end

      # def approve_payment

      #     service = BuyPowerPaymentService.new
      #     service_response = service.pay_power(@bill_order)
      #     if service_response[:status] == "success"
      #         render json: { success: true, data: service_response[:response], message: "payment confirmed" }, status: :ok

      #     elsif service_response[:status] == "TIMEOUT"
      #         render json: { success: false, message: service_response[:response], code: 504 }, status: :request_timeout

      #     else
      #         render json: { success: false, message: service_response[:response] }, status: :unprocessable_entity
      #     end


      # end

      def approve_data
        service = BuyPowerPaymentService.new
        service_response = service.pay_data(@bill_order)
        if service_response[:status] == 'success'
          render json: { success: true, data: service_response[:response], message: 'payment confirmed' }, status: :ok
        else
          render json: { success: false, message: service_response[:response] }, status: :unprocessable_entity
        end
      end

      def buy_data
        service = BuyPowerPaymentService.new
        service_response = service.pay_data(@bill_order)
        if service_response[:status] == 'success'
          render json: { success: true, data: service_response[:response], message: 'payment confirmed' }, status: :ok
        else
          render json: { success: false, message: service_response[:response] }, status: :unprocessable_entity
        end
      end

      def confirm_payment
        payment_method = params[:payment_method]

        service = BuyPowerPaymentService.new
        service_response = service.confirm_subscription(@bill_order, payment_method)
        if service_response[:status] == 'success'
          render json: { success: true, data: service_response[:response], message: 'payment confirmed' }, status: :ok
        else
          render json: { success: false, message: service_response[:response] }, status: :unprocessable_entity
        end
      end

      def repurchase
        service = BuyPowerPaymentService.new
        service_response = service.repurchase_subscription(current_user, @bill_order)

        if service_response[:status] === 'success'
          render json: { data: service_response[:response], message: 'payment confirmed' }, status: :ok

        else

          render json: { message: service_response[:response] }, status: :unprocessable_entity


        end
      end

      def update_status
        reference = params[:id]
        transaction_record = TransactionRecord.find_by(reference: reference)
        ref_type = reference.split('-').first


        case ref_type
        when 'bbg'
          transaction_record.bill_order.update(status: 'declined')

        when 'fbg'
          transaction_record.exchange.update(status: 'declined')

        else
          render json: { message: 'transaction_declined' }, status: :unprocessible_entity
        end

        render json: { message: 'transaction_declined' }, status: :ok
      end

      def get_ref_order
        order = nil

        reference = params[:id]

        transaction_record = TransactionRecord.find_by(reference: reference)

        unless transaction_record.present?
          return render json: { message: 'transaction not found' }, status: :unprocessable_entity
        end

        ref_type = reference.split('-').first


        case ref_type
        when 'bbg'
          order = transaction_record.bill_order

        when 'fbg'
          order = transaction_record.exchange

        else
          render json: { message: 'transaction not found' }, status: :unprocessable_entity
        end

        render json: { data: order }, status: :ok
      end

      def process_payment
        service = BuyPowerPaymentService.new



        service_response = service.process_payment(current_user, payment_processor_params)

        if service_response[:status] == 'success'

          render json: { data: service_response[:response], message: 'Transaction initiated' }, status: :created
        else
          render json: { message: service_response[:response] }, status: :unprocessable_entity
        end
      end

      def get_balance
        BuyPowerPaymentService.new
        service_response.get_wallet_balance
        if service_response[:status] == 'success'

          render json: { data: service_response[:response], message: 'balance initiated' }, status: :ok
        else
          render json: { message: service_response[:response] }, status: :unprocessable_entity
        end
      end

      def get_price_list
        provider = params[:provider]
        service_type = params[:service_type]


        service = BuyPowerPaymentService.new
        service_response = service.get_list(service_type, provider)

        if service_response[:status] == 'success'
          render json: { data: service_response[:response] }, status: :ok

        else

          render json: { message: service_response[:response] }, status: :unprocessable_entity
        end
      end

      def query_transaction
        service = BuyPowerPaymentService.new
        response_service = service.re_query(@bill_order[:id])

        if response_service[:status] == :ok
          data = response_service[:response]&.dig('result', 'data') || response_service[:response]&.dig('data')
          render json: { data: data }, status: :ok

        else

          render json: { message: response_service[:response] }, status: :unprocessable_entity
        end
      end

      def payment_processor_params
        params.permit(:billersCode, :amount, :request_id, :meter_type, :phone, :biller, :email, :status,
                      :tariff_class, :service_type, :skip, :description, :type, :use_commission)
      end

      def verify_processor_params
        params.permit(:billersCode, :serviceID, :type)
      end

      def set_bill_order
        @bill_order = BillOrder.find_by(id: params[:id])
        return if @bill_order.present?

        render json: { message: 'Not found' }, status: :unprocessable_entity
      end
    end
  end
end
