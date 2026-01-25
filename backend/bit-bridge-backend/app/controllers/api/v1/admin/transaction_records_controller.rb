# frozen_string_literal: true

module Api
  module V1
    module Admin
      class TransactionRecordsController < ApplicationController
        before_action :authenticate_user!
        before_action :ensure_super_admin!

        def index
          limit = parse_limit(params[:limit])
          return if performed?

          scope = TransactionRecord.order(created_at: :desc)
          scope = scope.where('created_at < ?', parse_before(params[:before])) if params[:before].present?
          return if performed?

          if params[:reference_prefix].present?
            prefix = params[:reference_prefix].to_s
            scope = scope.where('reference LIKE ?', "#{prefix}%")
          end

          if params[:status].present?
            scope = scope.where(status: params[:status].to_s)
          end

          records = scope.limit(limit)

          AdminAuditEvent.create!(
            admin_user_id: current_user.id,
            action: 'admin.transaction_records.list',
            ip: request.remote_ip.to_s,
            user_agent: request.user_agent.to_s,
            metadata: {
              limit: limit,
              before: params[:before],
              status: params[:status],
              reference_prefix: params[:reference_prefix],
              request_id: request.request_id
            }
          )

          data = records.map do |record|
            {
              id: record.id,
              reference: record.reference,
              status: record.status,
              event_type: record.event_type,
              amount: record.amount,
              created_at: record.created_at,
              updated_at: record.updated_at,
              transaction_id: record.transaction_id,
              bill_order_id: record.bill_order_id,
              exchange_id: record.exchange_id
            }
          end

          render json: { data: data }, status: :ok
        end

        private

        def parse_limit(raw)
          limit = raw.present? ? Integer(raw) : 50
          if limit <= 0
            render json: { message: 'limit must be between 1 and 200' }, status: :unprocessable_entity
            return
          end
          [limit, 200].min
        rescue ArgumentError, TypeError
          render json: { message: 'limit must be an integer' }, status: :unprocessable_entity
          nil
        end

        def parse_before(value)
          Time.iso8601(value.to_s)
        rescue ArgumentError
          render json: { message: 'before must be ISO8601' }, status: :unprocessable_entity
          nil
        end
      end
    end
  end
end
