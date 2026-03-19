# frozen_string_literal: true

module Api
  module V1
    module Admin
      class UserRiskControlsController < ApplicationController
        before_action :authenticate_user!
        before_action :ensure_risk_controls_admin!
        before_action :set_user

        def show
          render json: { data: risk_control_payload(@user.user_risk_control) }, status: :ok
        end

        def update
          control = @user.user_risk_control || @user.build_user_risk_control
          previous_restricted = control.restricted?

          control.assign_attributes(risk_control_params)
          control.set_by_admin = current_user
          control.released_by_admin = current_user if previous_restricted && !control.restricted?
          control.released_at = Time.current if previous_restricted && !control.restricted?

          control.save!
          sync_provider_freeze!(control: control, previous_restricted: previous_restricted)
          log_admin_audit('risk_control.update', metadata: {
                            monitoring_enabled: control.monitoring_enabled,
                            auto_lock_enabled: control.auto_lock_enabled,
                            restricted: control.restricted
                          })

          render json: { data: risk_control_payload(control), message: 'Risk controls updated' }, status: :ok
        rescue ActiveRecord::RecordInvalid => e
          render json: { message: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
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

        def risk_control_params
          params.require(:risk_control).permit(
            :monitoring_enabled,
            :auto_lock_enabled,
            :single_txn_limit_cents,
            :daily_limit_cents,
            :weekly_limit_cents,
            :restricted,
            :restriction_reason
          )
        end

        def risk_control_payload(control)
          {
            monitoring_enabled: control&.monitoring_enabled || false,
            auto_lock_enabled: control&.auto_lock_enabled || false,
            single_txn_limit_cents: control&.single_txn_limit_cents,
            daily_limit_cents: control&.daily_limit_cents,
            weekly_limit_cents: control&.weekly_limit_cents,
            restricted: control&.restricted || false,
            restriction_reason: control&.restriction_reason,
            provider_freeze_requested_at: control&.provider_freeze_requested_at,
            provider_freeze_status: control&.provider_freeze_status,
            provider_freeze_error: control&.provider_freeze_error,
            set_by_admin_id: control&.set_by_admin_id,
            released_by_admin_id: control&.released_by_admin_id,
            released_at: control&.released_at
          }
        end

        def log_admin_audit(action, metadata: {})
          AdminAuditEvent.create!(
            admin_user_id: current_user.id,
            target_user_id: @user.id,
            action: action,
            ip: request.remote_ip.to_s,
            user_agent: request.user_agent.to_s,
            metadata: metadata
          )
        rescue StandardError
          nil
        end

        def sync_provider_freeze!(control:, previous_restricted:)
          return if !previous_restricted && !control.restricted?
          return if previous_restricted == control.restricted?

          if control.restricted?
            Risk::ProviderAccountFreeze.freeze_for_user!(
              user: @user,
              control: control,
              reason: control.restriction_reason
            )
          else
            Risk::ProviderAccountFreeze.unfreeze_for_user!(
              user: @user,
              control: control
            )
          end
        end
      end
    end
  end
end
