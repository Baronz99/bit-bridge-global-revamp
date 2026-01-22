#!/usr/bin/env ruby
# frozen_string_literal: true

# DRY_RUN=1 CUTOFF_DAYS=30 rails runner script/backfill_bill_order_debits.rb

dry_run = ENV.fetch('DRY_RUN', '1') != '0'
cutoff_days = (ENV['CUTOFF_DAYS'] || '0').to_i
min_time = cutoff_days.positive? ? cutoff_days.days.ago : Time.at(0)

stats = {
  scanned: 0,
  eligible: 0,
  would_create: 0,
  created: 0,
  skipped_existing: 0,
  missing_wallet: 0,
  non_positive: 0,
  finalizer_skipped: 0,
  errors: 0
}

BillOrder.where(status: :completed)
         .where(payment_method: :wallet)
         .where('created_at >= ?', min_time)
         .find_each(batch_size: 200) do |bo|
  stats[:scanned] += 1
  begin
    wallet = Wallet.find_by(user_id: bo.user_id, wallet_type: :ngn)
    unless wallet
      stats[:missing_wallet] += 1
      next
    end

    amount = (bo.total_amount.presence || bo.amount).to_d
    if amount <= 0
      stats[:non_positive] += 1
      next
    end

    if WalletLedgerEntry.debit_exists?(wallet: wallet, bill_order: bo)
      stats[:skipped_existing] += 1
      next
    end

    stats[:eligible] += 1
    if dry_run
      stats[:would_create] += 1
      next
    end

    before_count = WalletLedgerEntry.where(wallet: wallet, bill_order: bo, entry_type: :debit).count
    BillOrders::Finalizer.call(bill_order: bo)
    after_count = WalletLedgerEntry.where(wallet: wallet, bill_order: bo, entry_type: :debit).count

    if after_count > before_count
      stats[:created] += 1
    else
      stats[:finalizer_skipped] += 1
    end
  rescue StandardError => e
    stats[:errors] += 1
    Rails.logger.error("[backfill_bill_order_debits] bill_order=#{bo.id} error=#{e.class}: #{e.message}")
  end
end

puts stats.inspect
