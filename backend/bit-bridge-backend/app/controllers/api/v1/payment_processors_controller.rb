# frozen_string_literal: true

module Api
  module V1
    class PaymentProcessorsController < ApplicationController
      before_action :set_bill_order, only: %i[show confirm_payment repurchase query_transaction]

      def verify_meter
        service = BuyPowerPaymentService.new
        service.verify_meter(verify_processor_params)
      end

      def show
        render json: { data: BillOrderSerializer.new(@bill_order) }
      end

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

        if service_response[:status] == 'success'
          render json: { data: service_response[:response], message: 'payment confirmed' }, status: :ok
        else
          render json: { message: service_response[:response] }, status: :unprocessable_entity
        end
      end

def update_status
  reference = params[:id].to_s
  transaction_record = TransactionRecord.find_by(reference: reference)
  return render json: { message: 'transaction_not_found' }, status: :not_found unless transaction_record

  ref_type = reference.split('-').first
  cutoff = (ENV['PAYMENT_DECLINE_CUTOFF_MINUTES'] || 30).to_i.minutes.ago

  case ref_type
  when 'bbg'
    order = transaction_record.bill_order
    return render json: { message: 'order_not_found' }, status: :not_found unless order

    # only decline if still in a non-terminal state AND old enough
    if order.created_at <= cutoff && !BillOrder::TERMINAL_STATUSES.include?(order.status.to_s)
      order.update(status: 'declined')
      return render json: { message: 'transaction_declined' }, status: :ok
    end

    return render json: { message: 'no_action' }, status: :ok

  when 'fbg'
    exchange = transaction_record.exchange
    return render json: { message: 'exchange_not_found' }, status: :not_found unless exchange

    terminal = %w[approved completed success paid failed cancelled reversed expired declined]
    if exchange.created_at <= cutoff && !terminal.include?(exchange.status.to_s.downcase)
      exchange.update(status: 'declined')
      return render json: { message: 'transaction_declined' }, status: :ok
    end

    return render json: { message: 'no_action' }, status: :ok
  else
    render json: { message: 'invalid_reference' }, status: :unprocessable_entity
  end
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
        service = BuyPowerPaymentService.new
        service_response = service.get_wallet_balance

        if service_response[:status] == 'success'
          render json: { data: service_response[:response], message: 'balance initiated' }, status: :ok
        else
          render json: { message: service_response[:response] }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/payment_processors/get_price_list?provider=mtn&service_type=DATA
#
# Notes:
# - BuyPower accepts verticals like DATA, TV, ELECTRICITY (NOT VTU, AIRTIME, CABLE)
# - Airtime (VTU) does NOT need a tariff list (user enters amount)
# - We normalize common aliases from frontend to what upstream expects.
def get_price_list
  provider = params[:provider].to_s.strip.downcase
  service_type = params[:service_type].to_s.strip.upcase

  if provider.blank? || service_type.blank?
    return render json: { message: 'provider and service_type are required' }, status: :unprocessable_entity
  end

  # ✅ Normalize service types (verticals) to upstream accepted values
  normalized_service_type =
    case service_type
    when 'CABLE', 'CABLETV', 'CABLE_TV'
      'TV'
    when 'AIRTIME', 'VTU'
      'VTU' # we keep this internally so we can short-circuit below
    else
      service_type
    end

  # ✅ Normalize provider values
  normalized_provider =
    case provider
    when '9-mobile', '9mobile', '9_mobil', 'etisalat', 'emts'
      '9mobile'
    when 'startimes', 'star-times', 'star_times'
      'startimes'
    else
      provider
    end

  # ------------------------------------------------------------
  # 🚫 IMPORTANT: BuyPower does NOT support VTU/AIRTIME tariffs
  # Airtime is a "user enters amount" flow, so return empty list.
  # ------------------------------------------------------------
  if normalized_service_type == 'VTU'
    return render json: { data: [] }, status: :ok
  end

  service = BuyPowerPaymentService.new
  service_response = service.get_list(normalized_service_type, normalized_provider)

  if service_response[:status] == 'success'
    return render json: { data: service_response[:response] }, status: :ok
  end

  status_code = service_response[:code].presence || :unprocessable_entity
  render json: {
    message: service_response[:response],
    code: service_response[:code],
    provider: normalized_provider,
    service_type: normalized_service_type
  }, status: status_code
rescue StandardError => e
  Rails.logger.error("[get_price_list] #{e.class}: #{e.message}")
  Rails.logger.error(e.backtrace.take(20).join("\n"))
  render json: { message: 'Price list unavailable', error: e.message, code: 503 }, status: :service_unavailable
end


      def query_transaction
        service = BuyPowerPaymentService.new
        previous_status = @bill_order&.status
        response_service = service.re_query(@bill_order[:id])
        resulting_status = @bill_order&.reload&.status

        log_admin_audit_transaction_query(
          bill_order: @bill_order,
          previous_status: previous_status,
          resulting_status: resulting_status,
          provider_response: safe_provider_response(response_service[:response])
        )

        if response_service[:status] == :ok
          data = response_service[:response]&.dig('result', 'data') || response_service[:response]&.dig('data')
          render json: { data: data }, status: :ok
        else
          render json: { message: response_service[:response] }, status: :unprocessable_entity
        end
      end

      def payment_processor_params
        params.permit(
          :billersCode, :amount, :request_id, :meter_type, :phone, :biller, :email, :status,
          :tariff_class, :service_type, :skip, :description, :type, :use_commission
        )
      end

      def verify_processor_params
        params.permit(:billersCode, :serviceID, :type)
      end

      def set_bill_order
        @bill_order = BillOrder.find_by(id: params[:id]) ||
                      BillOrder.find_by(provider_reference: params[:id])
        return if @bill_order.present?

        render json: { message: 'Not found' }, status: :unprocessable_entity
      end

      def safe_provider_response(response)
        payload =
          if response.respond_to?(:parsed_response)
            response.parsed_response
          elsif response.respond_to?(:to_h)
            response.to_h
          else
            response
          end

        return payload unless payload.is_a?(Hash)

        payload.slice('data', 'result', 'message', 'status', 'responseCode', 'error')
      end

      def log_admin_audit_transaction_query(bill_order:, previous_status:, resulting_status:, provider_response:)
        admin_actor_id = current_user&.id || User.where(role: 'admin').order(created_at: :desc).first&.id
        return unless admin_actor_id

        AdminAuditEvent.create!(
          admin_user_id: admin_actor_id,
          target_user_id: bill_order&.user_id,
          action: 'transaction_query',
          ip: request.remote_ip.to_s,
          user_agent: request.user_agent.to_s,
          metadata: {
            transaction_id: bill_order&.id,
            provider_reference: bill_order&.provider_reference || bill_order&.transaction_id,
            previous_status: previous_status,
            resulting_status: resulting_status,
            provider_response: provider_response
          }
        )
      end
    end
  end
end
