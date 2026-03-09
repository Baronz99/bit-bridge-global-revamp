# frozen_string_literal: true

module Core
  module Ops
    class RepairStaleUnprocessableBillOrders
      attr_reader :updated, :skipped, :candidates, :dry_run, :limit, :cutoff_time

      REPAIR_REASON = 'reconcile_stalled_unprocessable_closed'
      REPAIR_ACTOR = 'ops_repair'

      def initialize(cutoff_time:, limit:, dry_run: true)
        @cutoff_time = cutoff_time
        @limit = limit
        @dry_run = dry_run
        @updated = 0
        @skipped = 0
        @candidates = 0
      end

      def run
        scope.find_each do |order|
          @candidates += 1
          repair_reference = "repair/reconcile-stalled-unprocessable/#{order.id}"

          order.with_lock do
            order.reload
            if BillOrder::TERMINAL_STATUSES.include?(order.status.to_s)
              @skipped += 1
              next
            end

            meta = order.provider_response.is_a?(Hash) ? order.provider_response.dup : {}
            if meta['repair_reference'] == repair_reference
              @skipped += 1
              next
            end

            if WalletLedgerEntry.where(bill_order_id: order.id).exists?
              @skipped += 1
              next
            end

            apply_repair(order, meta, repair_reference) unless dry_run
            @updated += 1
          end
        end

        self
      end

      def summary
        { updated: updated, skipped: skipped, candidates: candidates, dry_run: dry_run }
      end

      private

      def scope
        BillOrder.where(status: :processing)
                 .where('created_at <= ?', cutoff_time)
                 .where('reason ILIKE ?', '%unprocessable_entity%')
                 .limit(limit)
      end

      def apply_repair(order, meta, repair_reference)
        meta['repair'] = true
        meta['repair_reference'] = repair_reference
        meta['repair_at'] = Time.current.utc.iso8601
        meta['repair_actor'] = REPAIR_ACTOR
        meta['previous_status'] = order.status
        meta['previous_reason'] = order.reason
        meta['note'] = 'auto-close processing order stuck after unprocessable_entity'
        order.status = :failed
        order.reason = REPAIR_REASON
        order.provider_response = meta
        order.save!
      end
    end
  end

end
