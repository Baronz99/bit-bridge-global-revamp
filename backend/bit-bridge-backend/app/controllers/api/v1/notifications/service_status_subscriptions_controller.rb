# frozen_string_literal: true

module Api
  module V1
    module Notifications
      class ServiceStatusSubscriptionsController < ApplicationController
        before_action :authenticate_user!

        def index
          subscription = current_subscription

          render json: {
            success: true,
            data: serialize_subscription(subscription)
          }, status: :ok
        end

        def create
          attrs = normalized_params
          subscription = current_user.service_status_subscriptions
                                     .find_or_initialize_by(
                                       provider: attrs[:provider],
                                       service_key: attrs[:service_key],
                                       channel: attrs[:channel]
                                     )
          subscription.active = true
          subscription.expires_at = attrs[:expires_at]
          subscription.metadata = attrs[:metadata]
          subscription.save!

          render json: {
            success: true,
            message: 'Service status alert enabled',
            data: serialize_subscription(subscription)
          }, status: :ok
        rescue ActiveRecord::RecordInvalid => e
          render json: { success: false, message: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
        end

        def destroy
          subscription = current_subscription
          return render json: { success: false, message: 'Subscription not found' }, status: :not_found if subscription.blank?

          subscription.update!(active: false)

          render json: {
            success: true,
            message: 'Service status alert disabled',
            data: serialize_subscription(subscription)
          }, status: :ok
        end

        private

        def current_subscription
          attrs = normalized_params
          current_user.service_status_subscriptions.find_by(
            provider: attrs[:provider],
            service_key: attrs[:service_key],
            channel: attrs[:channel]
          )
        end

        def normalized_params
          payload = subscription_params
          {
            provider: payload[:provider].presence || 'buypower',
            service_key: payload[:service_key].to_s.strip.upcase,
            channel: payload[:channel].presence || 'push',
            expires_at: expires_at_for(payload[:expires_in_hours]),
            metadata: payload[:metadata].is_a?(Hash) ? payload[:metadata] : {}
          }
        end

        def expires_at_for(raw_hours)
          hours = Integer(raw_hours.presence || 72)
          Time.current + hours.hours
        rescue ArgumentError, TypeError
          Time.current + 72.hours
        end

        def serialize_subscription(subscription)
          {
            subscribed: subscription&.active? || false,
            provider: subscription&.provider || normalized_params[:provider],
            service_key: subscription&.service_key || normalized_params[:service_key],
            channel: subscription&.channel || normalized_params[:channel],
            expires_at: subscription&.expires_at&.iso8601,
            last_notified_state: subscription&.last_notified_state
          }
        end

        def subscription_params
          params.permit(:provider, :service_key, :channel, :expires_in_hours, metadata: {})
        end
      end
    end
  end
end
