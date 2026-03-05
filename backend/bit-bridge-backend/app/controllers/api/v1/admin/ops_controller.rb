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
          provisioning = anchor_provisioning_health

          {
            webhook_secret_present: ENV['ANCHOR_WEBHOOK_SECRET'].to_s.strip.present?,
            webhook_signature_mode: ENV['ANCHOR_WEBHOOK_SIGNATURE_MODE'].to_s.strip.presence || 'compat',
            last_webhook_at: last_event_at&.iso8601,
            pending_withdrawals: pending[:count],
            oldest_pending_withdrawal_at: pending[:oldest_at]&.iso8601,
            provisioning: provisioning
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

        def anchor_provisioning_health
          threshold_minutes = ENV.fetch('ANCHOR_PROVISIONING_STUCK_MINUTES', '10').to_i
          threshold_minutes = 10 if threshold_minutes <= 0
          cutoff = Time.current - threshold_minutes.minutes

          scope = Account.where(vendor: 'anchor', status: 'completed', account_number: [nil, ''])
          stale = scope.where('updated_at <= ?', cutoff)
          sample = stale.order(updated_at: :asc).limit(20).pluck(:id, :user_id, :account_id, :useable_id, :updated_at).map do |id, user_id, customer_id, deposit_id, updated_at|
            {
              account_id: id,
              user_id: user_id,
              customer_id: customer_id,
              deposit_account_id: deposit_id,
              updated_at: updated_at&.iso8601
            }
          end

          {
            threshold_minutes: threshold_minutes,
            missing_account_number_count: scope.count,
            stale_missing_account_number_count: stale.count,
            stale_oldest_updated_at: stale.minimum(:updated_at)&.iso8601,
            stale_sample: sample
          }
        end
      end
    end
  end
end
