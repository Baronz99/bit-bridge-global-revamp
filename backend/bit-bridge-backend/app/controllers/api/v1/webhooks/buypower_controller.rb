# frozen_string_literal: true

module Api
  module V1
    module Webhooks
      class BuypowerController < ApplicationController
        skip_before_action :authenticate_user!

        def create
          return head :unauthorized unless valid_token?

          event = WebhookEvent.create!(
            source: 'buypower',
            headers: request.headers.to_h.slice('HTTP_X_BUYPOWER_TOKEN', 'HTTP_USER_AGENT'),
            payload: raw_payload
          )

          ProcessBuypowerWebhookJob.perform_later(event.id)

          Rails.logger.info(
            "[BuyPowerWebhook] request_id=#{request.request_id} event_type=#{raw_payload['event'] || raw_payload[:event]}"
          )

          head :ok
        rescue StandardError => e
          Rails.logger.error("[BuyPowerWebhook] error request_id=#{request.request_id} #{e.class}: #{e.message}")
          head :ok # avoid retries from provider
        end

        private

        def valid_token?
          expected = ENV['BUYPOWER_WEBHOOK_TOKEN'].to_s.strip
          provided = request.headers['X-BuyPower-Token'].to_s.strip
          expected.present? && ActiveSupport::SecurityUtils.secure_compare(provided, expected)
        end

        def raw_payload
          @raw_payload ||= request.request_parameters.presence || JSON.parse(request.raw_post.presence || '{}')
        rescue JSON::ParserError
          {}
        end
      end
    end
  end
end
