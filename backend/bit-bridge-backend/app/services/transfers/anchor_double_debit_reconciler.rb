# frozen_string_literal: true

module Transfers
  class AnchorDoubleDebitReconciler
    DEFAULT_LIMIT = 1000
    DEFAULT_DRY_RUN = true

    def self.call(email: nil, from: nil, to: nil, limit: DEFAULT_LIMIT, dry_run: DEFAULT_DRY_RUN)
      new(email: email, from: from, to: to, limit: limit, dry_run: dry_run).call
    end

    def initialize(email:, from:, to:, limit:, dry_run:)
      @email = email.to_s.strip.downcase.presence
      @from = parse_time(from)
      @to = parse_time(to)
      @limit = limit.to_i.positive? ? limit.to_i : DEFAULT_LIMIT
      @dry_run = dry_run
    end

    def call
      summary = {
        dry_run: @dry_run,
        scanned_references: 0,
        candidate_references: 0,
        updated_transactions: 0,
        skipped_transactions: 0,
        errors: 0,
        affected_users: []
      }

      affected_user_ids = {}

      grouped_references.each do |group_row|
        summary[:scanned_references] += 1

        wallet_id = group_row.wallet_id
        transfer_reference = group_row.transfer_reference.to_s
        next if transfer_reference.blank?

        next unless anchor_settled_debit_exists?(wallet_id: wallet_id, transfer_reference: transfer_reference)

        summary[:candidate_references] += 1
        update_result = backfill_ledger_reserved_flag(wallet_id: wallet_id, transfer_reference: transfer_reference)
        summary[:updated_transactions] += update_result[:updated]
        summary[:skipped_transactions] += update_result[:skipped]

        if update_result[:user_id].present?
          affected_user_ids[update_result[:user_id]] = true
        end
      rescue StandardError => e
        summary[:errors] += 1
        Rails.logger.warn("[AnchorDoubleDebitReconciler] reconcile_failed wallet_id=#{wallet_id} reference=#{transfer_reference} message=#{e.message}")
      end

      summary[:affected_users] = affected_user_ids.keys
      summary
    end

    private

    attr_reader :dry_run

    def grouped_references
      scoped_anchor_withdrawals
        .select("transactions.wallet_id, metadata ->> 'transfer_reference' AS transfer_reference")
        .where("metadata ->> 'transfer_reference' IS NOT NULL")
        .group("transactions.wallet_id, metadata ->> 'transfer_reference'")
        .order(Arel.sql("MAX(transactions.created_at) DESC"))
        .limit(@limit)
    end

    def scoped_anchor_withdrawals
      scope = Transaction.unscoped.where(transaction_type: :withdrawal).where("metadata ->> 'provider' = ?", 'anchor')
      scope = scope.where("metadata ->> 'subtype' IN (?)", %w[principal fee])
      scope = scope.where(status: %i[pending approved])
      scope = scope.joins(wallet: :user).where(users: { email: @email }) if @email.present?
      scope = scope.where('transactions.created_at >= ?', @from) if @from.present?
      scope = scope.where('transactions.created_at <= ?', @to) if @to.present?
      scope.reorder(nil)
    end

    def anchor_settled_debit_exists?(wallet_id:, transfer_reference:)
      bill_order_id = BillOrder.where(user_id: Wallet.where(id: wallet_id).pick(:user_id), meter_number: transfer_reference).pick(:id)

      scope = WalletLedgerEntry.where(wallet_id: wallet_id, entry_type: :debit)
                             .where("metadata ->> 'source' = ?", 'anchor_transfer')
      scope = scope.where("metadata ->> 'transfer_reference' = ?", transfer_reference)
      if bill_order_id.present?
        scope = scope.or(
          WalletLedgerEntry
            .where(wallet_id: wallet_id, bill_order_id: bill_order_id, entry_type: :debit)
            .where("metadata ->> 'source' = ?", 'anchor_transfer')
        )
      end
      scope.exists?
    end

    def backfill_ledger_reserved_flag(wallet_id:, transfer_reference:)
      scope = Transaction
        .where(wallet_id: wallet_id, transaction_type: :withdrawal, status: %i[pending approved])
        .where("metadata ->> 'provider' = ?", 'anchor')
        .where("metadata ->> 'subtype' IN (?)", %w[principal fee])
        .where("metadata ->> 'transfer_reference' = ?", transfer_reference)
        .reorder(nil)

      updated = 0
      skipped = 0
      user_id = Wallet.where(id: wallet_id).pick(:user_id)

      scope.find_each(batch_size: 100) do |tx|
        metadata = tx.metadata.is_a?(Hash) ? tx.metadata.dup : {}
        if metadata['ledger_hold_reserved'] == true
          skipped += 1
          next
        end

        metadata['ledger_hold_reserved'] = true
        metadata['ledger_hold_reserved_backfilled_at'] = Time.current.iso8601
        if dry_run
          updated += 1
          next
        end

        tx.update!(metadata: metadata)
        updated += 1
      end

      { updated: updated, skipped: skipped, user_id: user_id }
    end

    def parse_time(value)
      return nil if value.blank?

      Time.zone.parse(value.to_s)
    rescue StandardError
      nil
    end
  end
end
