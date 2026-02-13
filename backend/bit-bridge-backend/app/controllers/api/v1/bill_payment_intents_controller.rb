# frozen_string_literal: true

module Api
  module V1
    class BillPaymentIntentsController < ApplicationController
      before_action :set_intent, only: %i[show execute]

      def create
        bill_order = current_user.bill_orders.find(params.require(:bill_order_id))
        intent = BillPaymentIntent.find_or_create_for_bill_order!(bill_order: bill_order)

        render json: { data: intent_payload(intent), message: 'Bill payment intent created' }, status: :ok
      end

      def show
        render json: intent_status_payload(@intent), status: :ok
      end

      def execute
        result = Bills::ExecuteIntent.call(intent: @intent, request_id: request.request_id)
        render json: result[:body], status: result[:http_status]
      end

      private

      def set_intent
        @intent = current_user.bill_payment_intents.find(params[:id])
      end

      def intent_payload(intent)
        intent.as_json(only: %i[id bill_order_id bill_type amount fee total status provider_reference expires_at created_at updated_at])
      end

      def intent_status_payload(intent)
        intent.as_json(
          only: %i[id status expires_at provider_reference bill_order_id metadata updated_at]
        )
      end
    end
  end
end
