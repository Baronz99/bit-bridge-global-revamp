# frozen_string_literal: true

module Core
  module Notifications
    class ServiceStatusSubscriptionManager
      DEFAULT_EXPIRY_HOURS = 72

      def self.subscribe!(**kwargs)
        new(**kwargs).subscribe!
      end

      def initialize(user:, provider:, service_key:, channel: 'push', metadata: {}, expires_at: nil)
        @user = user
        @provider = provider.to_s.strip.presence || 'buypower'
        @service_key = service_key.to_s.strip.upcase
        @channel = channel.to_s.strip.presence || 'push'
        @metadata = metadata.is_a?(Hash) ? metadata : {}
        @expires_at = expires_at || (Time.current + DEFAULT_EXPIRY_HOURS.hours)
      end

      def subscribe!
        return if @user.blank? || @service_key.blank?

        subscription = ServiceStatusSubscription.find_or_initialize_by(
          user: @user,
          provider: @provider,
          service_key: @service_key,
          channel: @channel
        )
        subscription.active = true
        subscription.expires_at = @expires_at
        subscription.metadata = subscription.metadata.merge(@metadata)
        subscription.save!
        subscription
      end
    end
  end
end
