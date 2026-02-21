# frozen_string_literal: true

module Transfers
  class AnchorFailedDebitRefundReconciler
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
        repaired_references: 0,
        skipped_references: 0,
        errors: 0,
        affected_users: [],
        remaining_unrecovered: 0
      }

      affected_user_ids = {}

      grouped_failed_references.each do |group_row|
        summary[:scanned_references] += 1

        wallet_id = group_row.wallet_id
        transfer_reference = group_row.transfer_reference.to_s
        next if transfer_reference.blank?

        wallet = Wallet.find_by(id: wallet_id)
        bill_order = find_transfer_bill_order(wallet: wallet, transfer_reference: transfer_reference)
        unless candidate_reference?(wallet: wallet, bill_order: bill_order)
          summary[:skipped_references] += 1
          next
        end

        summary[:candidate_references] += 1
        affected_user_ids[wallet.user_id] = true if wallet&.user_id.present?

        next if @dry_run

        result = Transfers::AnchorNgnTransferService.settle_failed_transfer!(
          wallet: wallet,
          transfer_reference: transfer_reference,
          reason: 'auto_reconcile_failed_debit_without_refund',
          provider_status: 'reconciler.detected',
          bill_order: bill_order
        )

        if result[:refund_entry].present?
          summary[:repaired_references] += 1
        else
          summary[:skipped_references] += 1
        end
      rescue StandardError => e
        summary[:errors] += 1
        Rails.logger.warn(
          "[AnchorFailedDebitRefundReconciler] reconcile_failed wallet_id=#{wallet_id} " \
          "reference=#{transfer_reference} message=#{e.message}"
        )
      end

      summary[:affected_users] = affected_user_ids.keys
      summary[:remaining_unrecovered] = unrecovered_count
      summary
    end

    private

    def grouped_failed_references
      failed_anchor_principals
        .select("transactions.wallet_id, metadata ->> 'transfer_reference' AS transfer_reference")
        .where("metadata ->> 'transfer_reference' IS NOT NULL")
        .group("transactions.wallet_id, metadata ->> 'transfer_reference'")
        .order(Arel.sql("MAX(transactions.created_at) DESC"))
        .limit(@limit)
    end

    def failed_anchor_principals
      scope = Transaction.unscoped.where(transaction_type: :withdrawal, status: %i[failed declined])
      scope = scope.where("metadata ->> 'provider' = ?", 'anchor')
      scope = scope.where("metadata ->> 'subtype' = ?", 'principal')
      scope = scope.joins(wallet: :user).where(users: { email: @email }) if @email.present?
      scope = scope.where('transactions.created_at >= ?', @from) if @from.present?
      scope = scope.where('transactions.created_at <= ?', @to) if @to.present?
      scope.reorder(nil)
    end

    def find_transfer_bill_order(wallet:, transfer_reference:)
      return nil if wallet.blank? || transfer_reference.blank?

      BillOrder.find_by(user_id: wallet.user_id, meter_number: transfer_reference)
    end

    def candidate_reference?(wallet:, bill_order:)
      return false if wallet.blank? || bill_order.blank?
      return false unless WalletLedgerEntry.debit_exists?(wallet: wallet, bill_order: bill_order)
      return false if WalletLedgerEntry.exists?(wallet: wallet, bill_order: bill_order, entry_type: :refund)

      true
    end

    def unrecovered_count
      count = 0

      grouped_failed_references.each do |group_row|
        wallet = Wallet.find_by(id: group_row.wallet_id)
        bill_order = find_transfer_bill_order(wallet: wallet, transfer_reference: group_row.transfer_reference.to_s)
        count += 1 if candidate_reference?(wallet: wallet, bill_order: bill_order)
      end

      count
    end

    def parse_time(value)
      return nil if value.blank?

      Time.zone.parse(value.to_s)
    rescue StandardError
      nil
    end
  end
end
