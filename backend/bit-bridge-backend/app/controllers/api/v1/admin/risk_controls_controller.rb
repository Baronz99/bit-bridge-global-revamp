# frozen_string_literal: true

module Api
  module V1
    module Admin
      class RiskControlsController < ApplicationController
        before_action :authenticate_user!
        before_action :ensure_risk_controls_admin!

        def index
          controls = filtered_controls
          event_counts = RiskEvent.where(user_id: controls.map(&:user_id)).group(:user_id).count
          latest_events = RiskEvent.where(user_id: controls.map(&:user_id))
                                   .select('DISTINCT ON (user_id) user_id, trigger_type, action_taken, created_at')
                                   .order('user_id, created_at DESC')
                                   .index_by(&:user_id)

          render json: {
            data: controls.map { |control| risk_control_payload(control, event_counts, latest_events) },
            summary: {
              monitored: UserRiskControl.where(monitoring_enabled: true).count,
              auto_lock_enabled: UserRiskControl.where(auto_lock_enabled: true).count,
              restricted: UserRiskControl.where(restricted: true).count
            }
          }, status: :ok
        end

        private

        def ensure_risk_controls_admin!
          return if current_user&.can_access_admin_feature?(:risk_controls)

          render json: { message: 'Not authorized' }, status: :forbidden
        end

        def filtered_controls
          scope = UserRiskControl.includes(user: :user_profile).order(restricted: :desc, updated_at: :desc)
          scope = scope.where(restricted: true) if params[:status] == 'restricted'
          scope = scope.where(monitoring_enabled: true) if params[:status] == 'monitored'
          scope = scope.where(auto_lock_enabled: true) if params[:status] == 'auto_lock'
          scope = scope.where('restriction_reason ILIKE ?', "%#{params[:query].to_s.strip}%") if params[:query].present?
          scope.limit(limit_param)
        end

        def limit_param
          requested = params[:limit].to_i
          return 50 if requested <= 0

          [requested, 100].min
        end

        def risk_control_payload(control, event_counts, latest_events)
          profile = control.user.user_profile
          latest_event = latest_events[control.user_id]

          {
            user_id: control.user_id,
            email: control.user.email,
            full_name: [profile&.first_name, profile&.last_name].compact.join(' ').presence,
            phone_number: profile&.phone_number,
            active: control.user.active,
            kyc_level: control.user.kyc_level,
            monitoring_enabled: control.monitoring_enabled,
            auto_lock_enabled: control.auto_lock_enabled,
            restricted: control.restricted,
            restriction_reason: control.restriction_reason,
            single_txn_limit_cents: control.single_txn_limit_cents,
            daily_limit_cents: control.daily_limit_cents,
            weekly_limit_cents: control.weekly_limit_cents,
            provider_freeze_status: control.provider_freeze_status,
            provider_freeze_requested_at: control.provider_freeze_requested_at,
            provider_freeze_error: control.provider_freeze_error,
            released_at: control.released_at,
            updated_at: control.updated_at,
            risk_events_count: event_counts[control.user_id] || 0,
            latest_risk_event: latest_event && {
              trigger_type: latest_event.trigger_type,
              action_taken: latest_event.action_taken,
              created_at: latest_event.created_at
            }
          }
        end
      end
    end
  end
end
