# frozen_string_literal: true

module Api
  module V1
    module Admin
      class OpsController < ApplicationController
        before_action :authenticate_user!
        before_action :ensure_super_admin!

        def health
          render json: {
            message: 'ok',
            data: {
              anchor: anchor_health,
              app_time: Time.current.iso8601
            }
          }, status: :ok
        end

        def summary
          data = Ops::SummaryBuilder.new(now: Time.current, window_hours: 24).call
          render json: { success: true, data: data }, status: :ok
        end

        private

        def anchor_health
          last_event_at = AnchorWebhookEvent.order(created_at: :desc).limit(1).pick(:created_at)
          pending = pending_anchor_transfers

          {
            webhook_secret_present: ENV['ANCHOR_WEBHOOK_SECRET'].to_s.strip.present?,
            last_webhook_at: last_event_at&.iso8601,
            pending_withdrawals: pending[:count],
            oldest_pending_withdrawal_at: pending[:oldest_at]&.iso8601
          }
        end

        def pending_anchor_transfers
          scope = Transaction
                  .where(status: 'pending', transaction_type: 'withdrawal')
                  .where.not(transfer_id: [nil, ''])
                  .where("metadata ->> 'provider' = ?", 'anchor')
                  .where("metadata ->> 'subtype' = ?", 'principal')

          {
            count: scope.count,
            oldest_at: scope.minimum(:created_at)
          }
        end
      end
    end
  end
end
