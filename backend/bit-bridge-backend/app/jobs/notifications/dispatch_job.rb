# frozen_string_literal: true

module Notifications
  class DispatchJob < ApplicationJob
    queue_as :default

    retry_on StandardError, wait: 10.seconds, attempts: 5

    def perform(notification_event_id)
      event = NotificationEvent.includes(user: :notification_devices).find_by(id: notification_event_id)
      return if event.blank?
      return if event.delivered?

      devices = event.user.notification_devices.active
      if devices.blank?
        event.update!(status: :failed, error_message: 'No active notification devices')
        return
      end

      event.update!(status: :processing, attempts: event.attempts.to_i + 1, error_message: nil)

      results = devices.map { |device| deliver_to_device(event: event, device: device) }
      if results.any? { |result| result[:delivered] }
        event.update!(status: :delivered, error_message: nil)
      else
        error = results.map { |r| r[:error] }.compact.join(', ').presence || 'All deliveries failed'
        event.update!(status: :failed, error_message: error)
      end
    end

    private

    def deliver_to_device(event:, device:)
      delivery = NotificationDelivery.find_or_create_by!(notification_event: event, notification_device: device)
      delivery.update!(attempts: delivery.attempts.to_i + 1, status: :queued)

      response = Notifications::Providers::ExpoPush.deliver(device: device, event: event)

      if response[:ok]
        delivery.update!(
          status: :delivered,
          delivered_at: Time.current,
          failed_at: nil,
          provider_ticket_id: response[:ticket_id],
          error_message: nil,
          provider_response: response
        )
        device.update_columns(last_seen_at: Time.current, updated_at: Time.current)
        { delivered: true }
      else
        maybe_disable_device!(device: device, response: response)
        delivery.update!(
          status: :failed,
          failed_at: Time.current,
          error_message: response[:error].to_s.truncate(300),
          provider_response: response
        )
        { delivered: false, error: response[:error] }
      end
    rescue StandardError => e
      delivery.update!(
        status: :failed,
        failed_at: Time.current,
        error_message: "#{e.class}: #{e.message}".truncate(300)
      ) if delivery&.persisted?
      { delivered: false, error: e.message }
    end

    def maybe_disable_device!(device:, response:)
      details = response[:details].to_s
      return unless details.match?(/DeviceNotRegistered|InvalidCredentials|MessageTooBig|MISMATCH_SENDER_ID/i)

      device.update_columns(active: false, updated_at: Time.current)
    end
  end
end
