# frozen_string_literal: true

module Core
  module Ops
    class SummaryBuilder
      TRANSFER_FAILURE_STATUSES = %w[failed declined error timeout timedout cancelled canceled reversed refunded].freeze
      TRANSFER_KNOWN_STATUSES = (
        %w[pending approved declined failed initialized completed refunded timedout disputed processing] +
        TRANSFER_FAILURE_STATUSES
      ).uniq.freeze

      def initialize(now: Time.current, window_hours: 24)
        @now = now
        @window_hours = window_hours.to_i.positive? ? window_hours.to_i : 24
      end

      def call
        {
          generated_at: @now.iso8601,
          window_hours: @window_hours,
          provider_availability: provider_availability_section,
          anchor_provisioning: anchor_provisioning_section,
          tier3_liveness: tier3_liveness_section,
          unmatched_credits: unmatched_credits_section,
          refund_requests: refund_requests_section,
          bill_orders: bill_orders_section,
          webhooks: webhooks_section,
          disputes: disputes_section,
          transfers_banking: transfers_banking_section
        }
      end

      private

      attr_reader :now, :window_hours

      def window_start
        now - window_hours.hours
      end

      def provider_availability_section
        snapshot = ServiceAvailability::SnapshotBuilder.new(now: now).call
        services = Array(snapshot[:services])
        states = services.map { |row| row[:state].to_s }

        {
          global_state: snapshot.dig(:global, :state).to_s,
          current_snapshot: snapshot,
          services_summary: {
            total_services: services.size,
            operational: states.count('operational'),
            degraded: states.count('degraded'),
            outage: states.count('outage'),
            unknown: states.count('unknown')
          }
        }
      end

      def anchor_provisioning_section
        threshold_minutes = ENV.fetch('ANCHOR_PROVISIONING_STUCK_MINUTES', '10').to_i
        threshold_minutes = 10 if threshold_minutes <= 0
        cutoff = now - threshold_minutes.minutes

        scope = Account.where(vendor: 'anchor', status: 'completed', account_number: [nil, ''])
        stale = scope.where('updated_at <= ?', cutoff)

        {
          threshold_minutes: threshold_minutes,
          missing_account_number_count: scope.count,
          stale_missing_account_number_count: stale.count,
          stale_oldest_updated_at: stale.minimum(:updated_at)&.iso8601
        }
      end

      def unmatched_credits_section
        scope = UnmatchedCredit.all
        pending_scope = scope.where(status: 'pending')

        {
          totals_by_status: {
            pending: pending_scope.count,
            resolved: scope.where(status: 'resolved').count,
            ignored: scope.where(status: 'ignored').count,
            total: scope.count
          },
          age_buckets: {
            older_than_30m: pending_scope.where('created_at <= ?', now - 30.minutes).count,
            older_than_6h: pending_scope.where('created_at <= ?', now - 6.hours).count,
            older_than_24h: pending_scope.where('created_at <= ?', now - 24.hours).count
          }
        }
      end

      def tier3_liveness_section
        processing_scope = UserKyc.where(tier3_status: "processing")

        {
          processing_current: processing_scope.count,
          processing_stuck: {
            older_than_15m: processing_scope.where("updated_at <= ?", now - 15.minutes).count,
            older_than_30m: processing_scope.where("updated_at <= ?", now - 30.minutes).count,
            older_than_2h: processing_scope.where("updated_at <= ?", now - 2.hours).count
          },
          events: tier3_event_metrics
        }
      end

      def tier3_event_metrics
        return non_persisted_tier3_metrics unless tier3_events_available?

        scoped = KycTier3Event.where(provider: "prembly")
        windowed = scoped.where(created_at: window_start..now)
        {
          total_last_24h: windowed.count,
          success_last_24h: windowed.where(status: "success").count,
          retryable_failed_last_24h: windowed.where(status: "retryable_failed").count,
          failed_last_24h: windowed.where(status: %w[failed rejected timed_out]).count,
          last_event_at: scoped.maximum(:created_at)&.iso8601
        }
      end

      def tier3_events_available?
        defined?(KycTier3Event) && KycTier3Event.table_exists?
      rescue StandardError
        false
      end

      def non_persisted_tier3_metrics
        {
          total_last_24h: 0,
          success_last_24h: 0,
          retryable_failed_last_24h: 0,
          failed_last_24h: 0,
          last_event_at: nil
        }
      end

      def bill_orders_section
        {
          stuck_counts: {
            initialized: bill_order_stuck_counts_for('initialized'),
            pending: bill_order_stuck_counts_for('pending'),
            processing: bill_order_stuck_counts_for('processing')
          }
        }
      end

      def refund_requests_section
        {
          counts_by_status: refund_request_counts_by_status,
          sla_breaches: {
            received_older_than_48h: RefundRequest.where(status: RefundRequest.statuses[:received])
                                                   .where('requested_at <= ?', now - 48.hours)
                                                   .count,
            investigating_older_than_10_business_days: RefundRequest.where(status: RefundRequest.statuses[:investigating])
                                                                     .where('requested_at <= ?', business_days_ago(10))
                                                                     .count
          }
        }
      end

      def refund_request_counts_by_status
        grouped = RefundRequest.group(:status).count
        RefundRequest.statuses.each_with_object({ total: 0 }) do |(name, value), acc|
          count = grouped[value].to_i
          acc[name] = count
          acc[:total] += count
        end
      end

      def bill_order_stuck_counts_for(status)
        scope = BillOrder.where(status: status)
        {
          older_than_15m: scope.where('updated_at <= ?', now - 15.minutes).count,
          older_than_30m: scope.where('updated_at <= ?', now - 30.minutes).count,
          older_than_2h: scope.where('updated_at <= ?', now - 2.hours).count
        }
      end

      def webhooks_section
        {
          window_hours: window_hours,
          providers: {
            buypower: webhook_event_metrics(source: 'buypower'),
            anchor: anchor_webhook_metrics,
            monnify: webhook_event_metrics(source: 'monnify'),
            bridgecard: webhook_event_metrics(source: 'bridgecard')
          }
        }
      end

      def webhook_event_metrics(source:)
        scoped = webhook_scope_for(source)
        windowed = scoped.where(received_at: window_start..now)
        {
          received_last_24h: windowed.count,
          processed_last_24h: windowed.where(processing_status: 'processed').count,
          failed_last_24h: windowed.where(processing_status: 'failed').or(windowed.where.not(processing_error: [nil, ''])).count,
          unprocessed_current: scoped.where(processing_status: %w[received processing]).count,
          last_received_at: scoped.maximum(:received_at)&.iso8601
        }
      end

      def anchor_webhook_metrics
        scoped = AnchorWebhookEvent.all
        {
          received_last_24h: scoped.where(created_at: window_start..now).count,
          processed_last_24h: scoped.where(created_at: window_start..now).where.not(processed_at: nil).count,
          failed_last_24h: scoped.where(created_at: window_start..now).where.not(error_message: [nil, '']).count,
          unprocessed_current: scoped.where(processed_at: nil).count,
          last_received_at: scoped.maximum(:created_at)&.iso8601
        }
      end

      def non_persisted_webhook_metrics
        {
          received_last_24h: 0,
          processed_last_24h: 0,
          failed_last_24h: 0,
          unprocessed_current: 0,
          last_received_at: nil
        }
      end

      def webhook_scope_for(provider_name)
        WebhookEvent.where('LOWER(COALESCE(provider, source, ?)) = ?', '', provider_name.to_s.downcase)
      end

      def disputes_section
        open_scope = Dispute.where(status: Dispute.statuses[:open])
        oldest_open = open_scope.minimum(:created_at)

        {
          open_count: open_scope.count,
          oldest_open_age_hours: hours_since(oldest_open)
        }
      end

      def transfers_banking_section
        {
          anchor_pending_withdrawals: anchor_pending_withdrawals,
          transaction_records: transaction_record_signals
        }
      end

      def anchor_pending_withdrawals
        scope = Transaction
                .where(status: 'pending', transaction_type: 'withdrawal')
                .where.not(transfer_id: [nil, ''])
                .where("metadata ->> 'provider' = ?", 'anchor')
                .where("metadata ->> 'subtype' = ?", 'principal')

        oldest = scope.minimum(:created_at)
        {
          count: scope.count,
          oldest_pending_at: oldest&.iso8601,
          oldest_pending_age_hours: hours_since(oldest)
        }
      end

      def transaction_record_signals
        scope = TransactionRecord.where(created_at: window_start..now)
        failed = scope.where('LOWER(COALESCE(status, ?)) IN (?)', '', TRANSFER_FAILURE_STATUSES).count
        unknown = scope
                  .where.not('LOWER(COALESCE(status, ?)) IN (?)', '', TRANSFER_KNOWN_STATUSES)
                  .count

        {
          total_last_24h: scope.count,
          failed_last_24h: failed,
          unknown_status_last_24h: unknown
        }
      end

      def hours_since(timestamp)
        return nil if timestamp.blank?

        ((now - timestamp) / 1.hour).round(2)
      end

      def business_days_ago(days)
        cursor = now
        remaining = days
        while remaining.positive?
          cursor -= 1.day
          remaining -= 1 unless cursor.saturday? || cursor.sunday?
        end
        cursor
      end
    end
  end

end
