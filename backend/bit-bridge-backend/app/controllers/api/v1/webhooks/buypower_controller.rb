# frozen_string_literal: true

module Api
  module V1
    module Webhooks
      class BuypowerController < ApplicationController
        skip_before_action :authenticate_user!, raise: false

        def create
          return head :unauthorized unless valid_token?

          raw = request.raw_post.to_s
          parsed = nil
          parse_error = nil
          begin
            parsed = JSON.parse(raw)
          rescue JSON::ParserError => e
            parse_error = "parse_error: #{e.message}"
          end

          event = WebhookEvent.create!(
            provider: 'buypower',
            source: 'buypower',
            reference: parsed.is_a?(Hash) ? parsed['reference'].presence : nil,
            received_at: Time.current,
            signature_valid: true,
            processing_status: parse_error.present? ? 'failed' : 'received',
            headers: request.headers.env.select { |k, _| k.start_with?('HTTP') },
            payload: raw,
            payload_json: parsed,
            event_type: parsed.is_a?(Hash) ? (parsed['event'] || parsed[:event] || 'unknown') : 'unknown',
            processing_error: parse_error
          )

          ProcessBuypowerWebhookJob.perform_later(event.id) if parsed.present?

          Rails.logger.info(
            "[BuyPowerWebhook] request_id=#{request.request_id} event_type=#{event.event_type}"
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

      end
    end
  end
end
