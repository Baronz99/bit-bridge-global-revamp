# frozen_string_literal: true

class BuyPowerVerifyMeterJob < ApplicationJob
  queue_as :default

  MAX_RETRIES = 5

  def perform(bill_order_id)
    order = BillOrder.find_by(id: bill_order_id)
    return unless order
    return unless order.service_type.to_s.strip.upcase == 'ELECTRICITY'
    return if BillOrder::TERMINAL_STATUSES.include?(order.status.to_s)
    return if order.status.to_s == 'completed'

    service = BuyPowerPaymentService.new
    verify_payload = {
      billersCode: order.meter_number,
      biller: order.biller,
      meter_type: order.meter_type,
      service_type: 'ELECTRICITY'
    }

    begin
      response = service.verify_meter(verify_payload)
      name = extract_verification_name(response)
      address = extract_verification_address(response)
      meter_type = extract_verification_vend_type(response).presence || order.meter_type
      demand_category =
        response&.dig('demandCategory') ||
        response&.dig('data', 'demandCategory') ||
        response&.dig('result', 'data', 'demandCategory')

      order.with_lock do
        order.reload
        unless BillOrder::TERMINAL_STATUSES.include?(order.status.to_s) || order.status.to_s == 'completed'
          order.update!(
            name: name.presence,
            address: address.presence,
            meter_type: meter_type,
            demand_category: demand_category.presence || order.demand_category,
            status: 'initialized',
            reason: nil
          )
        end
      end
    rescue Timeout::Error, Net::OpenTimeout, Net::ReadTimeout
      schedule_retry(order)
    rescue StandardError => e
      message = e.message.to_s
      if invalid_meter_message?(message)
        order.update(status: 'failed', reason: message)
      else
        schedule_retry(order, reason: message)
      end
    end
  end

  private

  def schedule_retry(order, reason: nil)
    attempts = executions.to_i
    if attempts < MAX_RETRIES
      wait_window = 10.seconds * (attempts + 1)
      self.class.set(wait: wait_window).perform_later(order.id)
      order.update(reason: reason.presence || 'Meter verification pending. Please try again shortly.')
    else
      order.update(status: 'failed', reason: reason.presence || 'Meter verification failed. Please retry.')
    end
  end

  def invalid_meter_message?(message)
    text = message.to_s.downcase
    text.include?('invalid') ||
      text.include?('not found') ||
      text.include?('meter') && text.include?('exist')
  end

  def extract_verification_name(payload)
    return nil unless payload.is_a?(Hash)

    payload['name'] ||
      payload['customerName'] ||
      payload['customer_name'] ||
      payload.dig('data', 'name') ||
      payload.dig('data', 'customerName') ||
      payload.dig('data', 'customer_name') ||
      payload.dig('result', 'data', 'name') ||
      payload.dig('result', 'data', 'customerName') ||
      payload.dig('result', 'data', 'customer_name')
  end

  def extract_verification_address(payload)
    return nil unless payload.is_a?(Hash)

    payload['address'] ||
      payload.dig('data', 'address') ||
      payload.dig('result', 'data', 'address')
  end

  def extract_verification_vend_type(payload)
    return nil unless payload.is_a?(Hash)

    payload['vendType'] ||
      payload.dig('data', 'vendType') ||
      payload.dig('result', 'data', 'vendType')
  end
end
