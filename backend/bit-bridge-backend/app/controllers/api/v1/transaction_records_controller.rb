# frozen_string_literal: true

module Api
  module V1
    class TransactionRecordsController < ApplicationController
      before_action :set_transaction_record, only: %i[show update destroy]
      skip_before_action :authenticate_user!, only: %i[index]
      # GET /transaction_records
      def index
        @transaction_records = TransactionRecord.all
        render json: @transaction_records
      end

      # def initialize_transaction
      #   initialize_payment = PaymentService.new
      #  response =  initialize_payment.init_transaction(transaction_record_params)
      #  if response[:status] == :ok

      #   transaction = current_user.wallet.transactions.create(
      #     status: transaction_record_params[:status],
      #     transaction_type: transaction_record_params[:transaction_type],
      #     amount: transaction_record_params[:amount]
      #   )

      #   if transaction.persisted?
      #    transaction_record = TransactionRecord.new(exchange_id: transaction.id, reference: response[:response]["responseBody"]["paymentReference"])

      #     if transaction_record.save
      #     render json:  response[:response], status: :ok
      #     else
      #       render json: {message: transaction_record.errors.full_messages.to_sentence }, status: :unprocessable_entity

      #     end

      #   else
      #     render json: {message: transaction.errors.full_messages.to_sentence }, status: :unprocessable_entity

      #   end
      #  else
      #   render json: {message: response[:message]}, status: :bad_request
      #  end
      # end

      # GET /transaction_records/1
      def show
        record_type = params[:id].split('-').first
        record_item = record_type == 'bbg' ? @transaction_record.bill_order : @transaction_record.exchange
        render json: { data: record_item }, status: :ok
      end

      # POST /transaction_records
      def create
        @transaction_record = TransactionRecord.new(transaction_record_params)

        if @transaction_record.save
          render json: @transaction_record, status: :created, location: @transaction_record
        else
          render json: @transaction_record.errors, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /transaction_records/1
      def update
        if @transaction_record.update(transaction_record_params)
          render json: @transaction_record
        else
          render json: @transaction_record.errors, status: :unprocessable_entity
        end
      end

      # DELETE /transaction_records/1
      def destroy
        @transaction_record.destroy!
      end

      private

      # Use callbacks to share common setup or constraints between actions.
      def set_transaction_record
        @transaction_record = TransactionRecord.find_by(reference: params[:id])

        return if @transaction_record.present?

        render json: { message: 'Record does not exist' }, status: :not_found
        nil
      end

      # Only allow a list of trusted parameters through.
      def transaction_record_params
        params.require(:transaction_record).permit(:transaction_id, :status, :reference, :amount, :customer_name, :email,
                                                   :description, :phone_number, :redirect_url)
      end
    end
  end
end
