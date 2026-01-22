# frozen_string_literal: true

module Ledger
  class HoldInvariantRepairService
    STALE_STATUSES = %w[initialized processing pending].freeze

    attr_reader :commit, :actions

    def initialize(commit: false)
      @commit = commit
      @actions = { overclosed: [], stale: [] }
    end

    def run
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

      self
    end

    def summary
      {
        commit: commit,
        overclosed: actions[:overclosed].size,
        stale: actions[:stale].size
      }
    end

    private

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

