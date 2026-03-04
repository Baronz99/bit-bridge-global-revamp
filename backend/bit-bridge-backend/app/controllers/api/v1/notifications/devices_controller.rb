# frozen_string_literal: true

module Api
  module V1
    module Notifications
      class DevicesController < ApplicationController
        before_action :authenticate_user!

        def create
          payload = device_params
          token = payload[:token].to_s.strip
          return render json: { message: 'token is required' }, status: :unprocessable_entity if token.blank?

          device = NotificationDevice.find_or_initialize_by(provider: payload[:provider] || 'expo', token: token)
          device.user = current_user
          device.platform = payload[:platform].presence
          device.app_version = payload[:app_version].presence
          device.active = true
          device.metadata = payload[:metadata].is_a?(Hash) ? payload[:metadata] : {}
          device.last_seen_at = Time.current
          device.save!

          render json: {
            message: 'Device registered',
            data: {
              id: device.id,
              provider: device.provider,
              platform: device.platform,
              active: device.active,
              last_seen_at: device.last_seen_at
            }
          }, status: :ok
        rescue ActiveRecord::RecordInvalid => e
          render json: { message: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
        end

        def destroy
          token = params[:token].presence || params.dig(:device, :token).presence
          token = token.to_s.strip
          return render json: { message: 'token is required' }, status: :unprocessable_entity if token.blank?

          device = current_user.notification_devices.find_by(token: token)
          return render json: { message: 'Device not found' }, status: :not_found if device.blank?

          device.update!(active: false)
          render json: { message: 'Device unregistered' }, status: :ok
        end

        private

        def device_params
          params.require(:device).permit(:provider, :token, :platform, :app_version, metadata: {})
        rescue ActionController::ParameterMissing
          params.permit(:provider, :token, :platform, :app_version, metadata: {})
        end
      end
    end
  end
end
