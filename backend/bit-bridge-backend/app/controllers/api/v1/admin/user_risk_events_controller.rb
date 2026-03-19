# frozen_string_literal: true

module Api
  module V1
    module Admin
      class UserRiskEventsController < ApplicationController
        before_action :authenticate_user!
        before_action :ensure_risk_controls_admin!
        before_action :set_user

        def index
          events = @user.risk_events.order(created_at: :desc).limit(limit_param)

          render json: {
            data: events.map { |event| risk_event_payload(event) },
            summary: {
              total: @user.risk_events.count,
              latest_at: events.first&.created_at
            }
          }, status: :ok
        end

        private

        def ensure_risk_controls_admin!
          return if current_user&.can_access_admin_feature?(:risk_controls)

          render json: { message: 'Not authorized' }, status: :forbidden
        end

        def set_user
          @user = User.find_by(id: params[:user_id])
          return if @user

          render json: { message: 'User not found' }, status: :not_found
        end

        def limit_param
          requested = params[:limit].to_i
          return 25 if requested <= 0

          [requested, 100].min
        end

        def risk_event_payload(event)
          {
            id: event.id,
            trigger_type: event.trigger_type,
            amount_cents: event.amount_cents,
            threshold_cents: event.threshold_cents,
            action_taken: event.action_taken,
            source_type: event.source_type,
            source_id: event.source_id,
            metadata: event.metadata,
            created_at: event.created_at
          }
        end
      end
    end
  end
end
