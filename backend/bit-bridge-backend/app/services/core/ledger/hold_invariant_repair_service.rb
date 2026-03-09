# frozen_string_literal: true

module Core
  module Ledger
    class HoldInvariantRepairService
      STALE_STATUSES = %w[initialized processing pending].freeze

      attr_reader :commit, :actions

      def initialize(commit: false, reconcile_processing: false, reconcile_only: false, stale_processing: false, stale_processing_threshold_hours: 2)
        @commit = commit
        @reconcile_processing = reconcile_processing
        @reconcile_only = reconcile_only
        @stale_processing = stale_processing
        @stale_processing_threshold_hours = stale_processing_threshold_hours
        @actions = {
          overclosed: [],
          stale: [],
          reconciled_success: [],
          reconciled_failed: [],
          stale_processing: []
        }
      end

      def run
        run_reconcile_processing if @reconcile_processing
        return self if @reconcile_only

        candidate_bill_order_ids.each do |bill_order_id|
          bill_order = BillOrder.find_by(id: bill_order_id)
          next if bill_order.blank?
          next if bill_order.metadata&.[]('source') == 'anchor_transfer'

          wallet = bill_order.user&.wallet
          next unless wallet

          hold, release, debit = ledger_sums(bill_order)
          next if hold.zero? && release.zero? && debit.zero?

          handle_overclosed(wallet, bill_order, hold, release, debit)
          handle_stale(wallet, bill_order, hold, release, debit)
        end

        handle_stale_processing if @stale_processing

        self
      end

      def summary
        {
          commit: commit,
          overclosed: actions[:overclosed].size,
          stale: actions[:stale].size,
          reconciled_success: actions[:reconciled_success].size,
          reconciled_failed: actions[:reconciled_failed].size,
          stale_processing: actions[:stale_processing].size
        }
      end

      private

      def run_reconcile_processing
        service = Ledger::ProcessingHoldReconcileService.new(commit: commit)
        result = service.run
        actions[:reconciled_success].concat(result.actions[:reconciled_success])
        actions[:reconciled_failed].concat(result.actions[:reconciled_failed])
      end

      def candidate_bill_order_ids
        WalletLedgerEntry.where.not(bill_order_id: nil).distinct.pluck(:bill_order_id)
      end

      def ledger_sums(bill_order)
        totals = WalletLedgerEntry
                 .where(bill_order: bill_order)
                 .group(:entry_type)
                 .sum(:amount)

        [
          totals['hold'] || 0,
          totals['release'] || 0,
          totals['debit'] || 0
        ].map { |value| BigDecimal(value.to_s) }
      end

      def handle_overclosed(wallet, bill_order, hold, release, debit)
        excess = release + debit - hold
        return unless excess.positive?
        reference = credit_reference(bill_order.id)
        return if WalletLedgerEntry.exists?(bill_order: bill_order, entry_type: :credit, reference: reference)

        record(over_actions, bill_order, excess) do
          WalletLedgerEntry.record_credit!(
            wallet: wallet,
            bill_order: bill_order,
            amount: excess,
            reference: reference,
            metadata: { 'source' => 'ledger_repair', 'subtype' => 'hold_invariant' }
          )
        end
      end

      def handle_stale(wallet, bill_order, hold, release, debit)
        outstanding = hold - release - debit
        return if outstanding <= 0
        # processing/initialized/pending are intentionally skipped to avoid auto-releasing active flows;
        # they are handled via explicit reconciliation or guarded stale_processing mode.
        return if STALE_STATUSES.include?(bill_order.status.to_s)
        reference = stale_reference(bill_order.id)
        return if WalletLedgerEntry.exists?(bill_order: bill_order, entry_type: :release, reference: reference)

        record(stale_actions, bill_order, outstanding) do
          WalletLedgerEntry.release_hold!(
            wallet: wallet,
            bill_order: bill_order,
            amount: outstanding,
            reference: reference,
            metadata: { 'source' => 'ledger_repair', 'subtype' => 'hold_invariant' }
          )
        end
      end

      def handle_stale_processing
        cutoff = @stale_processing_threshold_hours.hours.ago
        BillOrder.where(status: %w[processing initialized], payment_method: :wallet)
                 .where('created_at < ?', cutoff)
                 .find_each do |bill_order|
          next if bill_order.metadata&.[]('source') == 'anchor_transfer'
          wallet = bill_order.user&.wallet
          next unless wallet

          hold, release, debit = ledger_sums(bill_order)
          outstanding = hold - release - debit
          next unless outstanding.positive?
          next if WalletLedgerEntry.debit_exists?(wallet: wallet, bill_order: bill_order)

          reference = stale_reference(bill_order.id)
          next if WalletLedgerEntry.exists?(bill_order: bill_order, entry_type: :release, reference: reference)

          record(actions[:stale_processing], bill_order, outstanding) do
            WalletLedgerEntry.release_hold!(
              wallet: wallet,
              bill_order: bill_order,
              amount: outstanding,
              reference: reference,
              metadata: { 'source' => 'ledger_repair', 'subtype' => 'hold_invariant', 'kind' => 'stale_hold' }
            )
          end
        end
      end

      def record(target, bill_order, amount)
        entry = commit ? yield : nil
        target << {
          bill_order_id: bill_order.id,
          amount: amount.to_d,
          created: commit && entry.present?
        }
      end

      def over_actions
        actions[:overclosed]
      end

      def stale_actions
        actions[:stale]
      end

      def credit_reference(bill_order_id)
        "repair/overclosed-hold/#{bill_order_id}"
      end

      def stale_reference(bill_order_id)
        "repair/stale-hold/#{bill_order_id}"
      end
    end
  end


end
