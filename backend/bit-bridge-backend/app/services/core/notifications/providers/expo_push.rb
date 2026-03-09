# frozen_string_literal: true

module Core
  require 'net/http'
  require 'uri'
  require 'json'

  module Notifications
    module Providers
      class ExpoPush
        ENDPOINT = 'https://exp.host/--/api/v2/push/send'

        def self.deliver(device:, event:)
          new(device: device, event: event).deliver
        end

        def initialize(device:, event:)
          @device = device
          @event = event
        end

        def deliver
          response = http_client.request(build_request)
          body = JSON.parse(response.body.to_s) rescue {}
          data = body['data'].is_a?(Hash) ? body['data'] : {}
          if response.code.to_i.between?(200, 299) && data['status'].to_s == 'ok'
            return { ok: true, ticket_id: data['id'], raw: body }
          end

          {
            ok: false,
            error: body['errors'] || body['message'] || "Expo push failed with HTTP #{response.code}",
            details: data['details'],
            raw: body
          }
        rescue StandardError => e
          { ok: false, error: "#{e.class}: #{e.message}" }
        end

        private

        def http_client
          uri = URI.parse(ENDPOINT)
          http = Net::HTTP.new(uri.host, uri.port)
          http.use_ssl = true
          http.read_timeout = 10
          http.open_timeout = 5
          http
        end

        def build_request
          uri = URI.parse(ENDPOINT)
          request = Net::HTTP::Post.new(uri.request_uri)
          request['Content-Type'] = 'application/json'
          token = ENV['EXPO_PUSH_ACCESS_TOKEN'].to_s.strip
          request['Authorization'] = "Bearer #{token}" if token.present?
          request.body = {
            to: @device.token,
            title: @event.title,
            body: @event.body,
            data: {
              event_type: @event.event_type,
              reference: @event.reference,
              deeplink: @event.deeplink,
              state: @event.state,
              resource_type: @event.resource_type,
              resource_id: @event.resource_id
            },
            priority: @event.high? ? 'high' : 'default',
            sound: 'default'
          }.to_json
          request
        end
      end
    end
  end

end
