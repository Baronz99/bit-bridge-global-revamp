# frozen_string_literal: true

require 'cgi'

module Core
  module Notifications
    class ServiceStatusRecoveryPublisher
      def self.call(provider:, previous_rows:, current_rows:, occurred_at: Time.current)
        new(provider:, previous_rows:, current_rows:, occurred_at:).call
      end

      def initialize(provider:, previous_rows:, current_rows:, occurred_at:)
        @provider = provider
        @previous_rows = previous_rows || {}
        @current_rows = current_rows || []
        @occurred_at = occurred_at
      end

      def call
        recovered_rows.each do |row|
          active_subscriptions_for(row).find_each do |subscription|
            publish!(subscription: subscription, row: row)
          end
        end
      end

      private

      def recovered_rows
        @current_rows.select do |row|
          previous = @previous_rows[row[:service_key]]
          next false if previous.blank?
          next false unless row[:state].to_s == 'available'

          %w[down unstable].include?(previous.state.to_s)
        end
      end

      def active_subscriptions_for(row)
        ServiceStatusSubscription.active.where(
          provider: @provider,
          service_key: row[:service_key],
          channel: 'push'
        )
      end

      def publish!(subscription:, row:)
        service_key = row[:service_key].to_s
        label = human_label(service_key)
        EventPublisher.call(
          user: subscription.user,
          event_type: 'service.status.restored',
          resource_type: 'provider_service_status',
          resource_id: service_key,
          state: 'available',
          title: "#{label} is back",
          body: "#{label} is available again. You can complete your payment now.",
          deeplink: "/powerProviders?service_key=#{CGI.escape(service_key)}",
          priority: 'normal',
          occurred_at: @occurred_at,
          idempotency_key: "service-restored:#{subscription.user_id}:#{@provider}:#{service_key}:#{row[:window_ended_at].to_i}",
          metadata: {
            provider: @provider,
            service_key: service_key,
            reliability_percent: row[:reliability_percent]
          }
        )

        subscription.update_columns(
          last_notified_state: 'available',
          last_notified_at: Time.current,
          active: false,
          updated_at: Time.current
        )
      end

      def human_label(service_key)
        parts = service_key.to_s.split('_')
        service_type = parts.pop.to_s.upcase
        provider = parts.join(' ').strip
        service_name =
          case service_type
          when 'ELECTRICITY' then 'Electricity'
          when 'VTU' then 'Airtime'
          else service_type.titleize
          end
        return service_name if provider.blank?

        "#{provider.titleize} #{service_name}"
      end
    end
  end
end
