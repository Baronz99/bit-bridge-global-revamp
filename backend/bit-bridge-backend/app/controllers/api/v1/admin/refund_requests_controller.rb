# frozen_string_literal: true

module Api
  module V1
    module Admin
      class RefundRequestsController < ApplicationController
        before_action :authenticate_user!
        before_action :require_admin!
        before_action :set_refund_request, only: [:update]

        def index
          scope = RefundRequest.order(created_at: :desc)
          scope = scope.where(status: params[:status].to_s) if params[:status].present?
          scope = scope.where('transaction_reference ILIKE ?', "%#{params[:reference].to_s.strip}%") if params[:reference].present?

          render json: {
            data: scope.limit(parse_limit(params[:limit])).map { |record| serialize_refund_request(record) }
          }, status: :ok
        end

        def create
          record = RefundRequest.new(create_params)
          record.requested_at ||= Time.current
          record.handled_by_admin_id = current_user.id

          if record.save
            render json: { success: true, data: serialize_refund_request(record) }, status: :created
          else
            render json: { success: false, message: record.errors.full_messages.to_sentence }, status: :unprocessable_entity
          end
        end

        def update
          new_status = update_params[:status].to_s.presence
          notes = update_params[:notes]
          acknowledged = ActiveModel::Type::Boolean.new.cast(update_params[:acknowledged])

          @refund_request.with_lock do
            if new_status.present? && !RefundRequest.statuses.key?(new_status)
              return render json: { success: false, message: 'status is invalid' }, status: :unprocessable_entity
            end

            if new_status.present? && @refund_request.status != new_status && !@refund_request.can_transition_to?(new_status)
              return render json: {
                success: false,
                message: "invalid transition from #{@refund_request.status} to #{new_status}"
              }, status: :unprocessable_entity
            end

            attrs = { handled_by_admin_id: current_user.id }
            attrs[:notes] = notes if update_params.key?(:notes)
            attrs[:acknowledged_at] = Time.current if acknowledged && @refund_request.acknowledged_at.blank?

            if new_status.present? && @refund_request.status != new_status
              attrs[:status] = new_status
              apply_status_timestamp(attrs, new_status)
            end

            @refund_request.update!(attrs)
          end

          render json: { success: true, data: serialize_refund_request(@refund_request.reload) }, status: :ok
        rescue ActiveRecord::RecordInvalid => e
          render json: { success: false, message: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
        end

        private

        def set_refund_request
          @refund_request = RefundRequest.find(params[:id])
        end

        def create_params
          params.require(:refund_request).permit(
            :user_id,
            :transaction_reference,
            :provider,
            :reason,
            :status,
            :requested_at,
            :notes
          )
        end

        def update_params
          params.require(:refund_request).permit(:status, :notes, :acknowledged)
        end

        def apply_status_timestamp(attrs, status)
          now = Time.current
          case status.to_s
          when 'investigating'
            attrs[:acknowledged_at] ||= now
          when 'approved'
            attrs[:approved_at] = now
            attrs[:acknowledged_at] ||= now
          when 'rejected'
            attrs[:rejected_at] = now
            attrs[:acknowledged_at] ||= now
          when 'refunded'
            attrs[:refunded_at] = now
            attrs[:acknowledged_at] ||= now
          end
        end

        def parse_limit(raw)
          value = raw.present? ? Integer(raw) : 100
          return [value, 200].min if value.positive?

          100
        rescue ArgumentError, TypeError
          100
        end

        def serialize_refund_request(record)
          {
            id: record.id,
            user_id: record.user_id,
            transaction_reference: record.transaction_reference,
            provider: record.provider,
            reason: record.reason,
            status: record.status,
            requested_at: record.requested_at,
            acknowledged_at: record.acknowledged_at,
            approved_at: record.approved_at,
            rejected_at: record.rejected_at,
            refunded_at: record.refunded_at,
            handled_by_admin_id: record.handled_by_admin_id,
            notes: record.notes,
            created_at: record.created_at,
            updated_at: record.updated_at
          }
        end
      end
    end
  end
end
