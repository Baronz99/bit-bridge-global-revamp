# frozen_string_literal: true

module Api
  module V1
    module Admin
      class UsersController < ApplicationController
        before_action :authenticate_user!
        before_action :set_user
        before_action :ensure_compliance!
        before_action :ensure_fresh_admin_session!

        # POST /api/v1/admin/users/:id/reveal
        def reveal
          payload = {
            email: @user.email,
            phone_number: @user.user_profile&.phone_number,
            virtual_accounts: @user.accounts.map do |account|
              {
                id: account.id,
                vendor: account.vendor,
                bank_name: account.bank_name,
                account_number: account.account_number
              }
            end
          }

          log_admin_audit('reveal_pii', metadata: { fields: %w[email phone_number virtual_accounts] })

          render json: { data: payload }, status: :ok
        end

        private

        def set_user
          @user = User.find_by(id: params[:id])
          return if @user

          render json: { message: 'User not found' }, status: :not_found
          return
        end

        def ensure_compliance!
          return if current_user&.compliance? || current_user&.super_admin?

          render json: { message: 'Not authorized' }, status: :forbidden
        end

        def ensure_fresh_admin_session!
          return if current_user&.admin_session_fresh?

          render json: { message: 'Re-auth required' }, status: :unauthorized
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
      end
    end
  end
end
