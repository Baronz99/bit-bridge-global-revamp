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
              kyc_reuse: kyc_reuse_health,
              app_time: Time.current.iso8601
            }
          }, status: :ok
        end

        def user_kyc_reuse
          user = User.includes(:user_kyc, :accounts).find(params[:user_id])
          user_kyc = user.user_kyc

          render json: {
            message: 'ok',
            data: {
              user_id: user.id,
              email: user.email,
              kyc_reuse: build_kyc_reuse_entry(user, user_kyc)
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

        def kyc_reuse_health
          scope = UserKyc.includes(:user).select(&:verified?)
          stale = scope.reject(&:bvn_identity_confirmed?)
          sample = stale.first(20).map { |user_kyc| build_kyc_reuse_entry(user_kyc.user, user_kyc) }

          {
            verified_bvn_total: scope.size,
            reusable_bvn_total: scope.count(&:bvn_identity_confirmed?),
            verified_missing_reusable_bvn_count: stale.size,
            stale_verified_bvn_sample: sample
          }
        end

        def recommended_kyc_reuse_action(anchor_provisioned:, cardholder_exists:, active_card_exists:)
          return 'secure_reconciliation_for_anchor_and_cards' if anchor_provisioned && (cardholder_exists || active_card_exists)
          return 'secure_reconciliation_for_cards' if cardholder_exists || active_card_exists
          return 'monitor_anchor_safe_cards_risky' if anchor_provisioned

          'secure_bvn_reentry_before_anchor_or_cards'
        end

        def build_kyc_reuse_entry(user, user_kyc)
          return nil unless user

          anchor_accounts = user.accounts.where(vendor: 'anchor')
          cards = Card.where(user_id: user.id)
          anchor_provisioned = anchor_accounts.where.not(account_number: [nil, '']).exists?
          cardholder_exists = cards.where.not(cardholder_id: [nil, '']).exists?
          active_card_exists = cards.where.not(status: [nil, '', 'failed', 'terminated', 'cancelled']).exists?
          verified = user_kyc&.verified? || false
          reusable = user_kyc&.bvn_identity_confirmed? || false

          {
            user_id: user.id,
            email: user.email,
            kyc_level: user.kyc_level,
            onboarding_stage: user.onboarding_stage,
            bvn_verified: verified,
            reusable_bvn_available: reusable,
            needs_review: verified && !reusable,
            has_anchor_account: anchor_accounts.exists?,
            anchor_account_provisioned: anchor_provisioned,
            has_cardholder_profile: cardholder_exists,
            has_cards: active_card_exists,
            recommended_action: recommended_kyc_reuse_action(
              anchor_provisioned: anchor_provisioned,
              cardholder_exists: cardholder_exists,
              active_card_exists: active_card_exists
            ),
            bvn_verified_at: user_kyc&.bvn_verified_at&.iso8601,
            updated_at: user_kyc&.updated_at&.iso8601
          }
        end
      end
    end
  end
end
