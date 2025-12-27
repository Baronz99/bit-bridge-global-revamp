# frozen_string_literal: true

module Api
  module V1
    module Admin
      class KycReviewsController < ApplicationController
        before_action :authenticate_user!
        before_action :ensure_admin!
        before_action :set_review, only: %i[update]

        def index
          scope = KycReview.where(kyc_type: 'bvn').order(created_at: :desc)
          scope = scope.where(status: params[:status]) if params[:status].present?
          render json: { data: ActiveModelSerializers::SerializableResource.new(scope, each_serializer: KycReviewSerializer) }, status: :ok
        end

        def update
          action_type = params[:action_type].to_s
          notes = params[:notes].to_s.presence
          reason = params[:reason].to_s.presence
          user = @review.user
          user_kyc = user.user_kyc || user.create_user_kyc

          case action_type
          when 'approve'
            user_kyc.update!(
              bvn_status: 'verified',
              bvn_verified_at: user_kyc.bvn_verified_at || Time.current
            )
            @review.update!(
              status: 'approved',
              notes: notes,
              reason: reason,
              decided_by_admin_id: current_user.id,
              decided_at: Time.current
            )
            user.update!(kyc_level: Kyc::LevelCalculator.resolve_level(user))
            log_audit(user, 'admin_review_action', 'approved', metadata: { review_id: @review.id, reason: reason })

          when 'reject'
            user_kyc.update!(
              bvn_status: 'rejected',
              bvn_verified_at: nil
            )
            @review.update!(
              status: 'rejected',
              notes: notes,
              reason: reason,
              decided_by_admin_id: current_user.id,
              decided_at: Time.current
            )
            user.update!(kyc_level: Kyc::LevelCalculator.resolve_level(user))
            log_audit(user, 'admin_review_action', 'rejected', metadata: { review_id: @review.id, reason: reason })

          when 'request_correction'
            @review.update!(
              status: 'in_review',
              notes: notes,
              reason: reason,
              assigned_to_admin_id: current_user.id
            )
            log_audit(user, 'admin_review_action', 'request_correction', metadata: { review_id: @review.id, reason: reason })

          when 'retry'
            return render json: { message: 'BVN retry requires the user to resubmit BVN.' }, status: :unprocessable_entity

          else
            return render json: { message: 'Invalid action' }, status: :unprocessable_entity
          end

          render json: { data: KycReviewSerializer.new(@review.reload), message: 'Review updated' }, status: :ok
        end

        private

        def ensure_admin!
          return if current_user&.admin?

          render json: { message: 'Not authorized' }, status: :forbidden
        end

        def set_review
          @review = KycReview.find(params[:id])
        end

        def log_audit(user, action, status, metadata: {})
          KycAuditLog.create!(
            user_id: user.id,
            admin_id: current_user.id,
            action: action,
            status: status,
            ip_address: request.remote_ip.to_s,
            metadata: metadata
          )
        rescue StandardError
          nil
        end
      end
    end
  end
end
