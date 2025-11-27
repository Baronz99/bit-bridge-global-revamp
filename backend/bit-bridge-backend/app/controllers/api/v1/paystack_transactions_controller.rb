# frozen_string_literal: true

module Api
  module V1
    class PaystackTransactionsController < ApplicationController
      skip_before_action :authenticate_user!

      def list_payments
        payment_service = PaystackPaymentService.new
        service = payment_service.list_transactions
        if service[:status] == true
          render json: service[:response], status: :ok

        else
          render json: service[:response], status: :unprocessable_entity

        end
      end

      def fetch_payment
        reference = params[:id]
        payment_service = PaystackPaymentService.new
        service = payment_service.fetch_transaction(reference)
        if service[:status] == true
          render json: service[:response], status: :ok

        else
          render json: service[:response], status: :unprocessable_entity

        end
      end

      def initialize_payment
        payment_service = PaystackPaymentService.new
        service = payment_service.initialize_transaction(payment_params)

        if service[:status] == true
          render json: service[:response], status: :ok

        else
          render json: service[:response], status: :unprocessable_entity

        end
      end

      def verify_payment
        reference = params[:reference]

        payment_service = PaystackPaymentService.new
        service = payment_service.verify_transaction(reference)
        if service[:status] == true
          render json: service[:response], status: :ok

        else
          render json: service[:response], status: :unprocessable_entity

        end
      end

      def payment_params
        params.permit(:email, :amount)
      end
    end
  end
end
