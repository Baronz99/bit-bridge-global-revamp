# frozen_string_literal: true

# Usage:
#   rails runner script/expire_stale_bill_orders.rb --minutes=30 --dry-run
#   rails runner script/expire_stale_bill_orders.rb --minutes=30
#   rails runner script/expire_stale_bill_orders.rb --minutes=30 --user=<USER_ID>
#
# Notes:
# - Only expires BillOrders that are initialized and stale
# - Ensures there are NO ledger entries tied to the bill_order (hold/release/debit)
# - Ensures provider reference is blank (adjust field names if yours differ)

require "optparse"

options = {
  minutes: 30,
  dry_run: true,
  user_id: nil,
  limit: 500
}

OptionParser.new do |opts|
  opts.on("--minutes=N", Integer) { |v| options[:minutes] = v }
  opts.on("--dry-run") { options[:dry_run] = true }
  opts.on("--commit")  { options[:dry_run] = false }
  opts.on("--user=ID", String) { |v| options[:user_id] = v }
  opts.on("--limit=N", Integer) { |v| options[:limit] = v }
end.parse!(ARGV)

cutoff = options[:minutes].minutes.ago
dry_run = options[:dry_run]

puts "=== Expire stale BillOrders ==="
puts "cutoff: created_at < #{cutoff} (#{options[:minutes]} minutes)"
puts "dry_run: #{dry_run}"
puts "user_id: #{options[:user_id] || '(all)'}"
puts "limit: #{options[:limit]}"
puts

scope = BillOrder.where(status: :initialized)
scope = scope.where(payment_method: :wallet) if BillOrder.column_names.include?("payment_method")
scope = scope.where(user_id: options[:user_id]) if options[:user_id].present?
scope = scope.where("created_at < ?", cutoff)

# If you store provider refs differently, adjust these checks:
provider_ref_fields = %w[provider_reference provider_ref provider_transaction_id provider_payment_id]
provider_ref_fields.select! { |f| BillOrder.column_names.include?(f) }

if provider_ref_fields.any?
  provider_ref_fields.each do |f|
    scope = scope.where(f => [nil, ""])
  end
end

candidates = scope.order(created_at: :asc).limit(options[:limit])

expired = []
skipped = []

candidates.find_each do |bo|
  next if bo.metadata&.[]('source') == 'anchor_transfer'

  hold_sum    = WalletLedgerEntry.where(bill_order_id: bo.id, entry_type: :hold).sum(:amount).to_d
  release_sum = WalletLedgerEntry.where(bill_order_id: bo.id, entry_type: :release).sum(:amount).to_d
  debit_sum   = WalletLedgerEntry.where(bill_order_id: bo.id, entry_type: :debit).sum(:amount).to_d

  if hold_sum != 0 || release_sum != 0 || debit_sum != 0
    skipped << [bo.id, bo.created_at, bo.status, "has_ledger_entries", hold_sum, release_sum, debit_sum]
    next
  end

  expired << [bo.id, bo.created_at, bo.total_amount, bo.user_id]
end

puts "candidates_checked: #{candidates.size}"
puts "eligible_to_expire: #{expired.size}"
puts "skipped: #{skipped.size}"
puts

if expired.any?
  puts "=== Eligible (no ledger + no provider ref) ==="
  expired.each do |row|
    puts "bill_order_id=#{row[0]} created_at=#{row[1]} total_amount=#{row[2]} user_id=#{row[3]}"
  end
  puts
end

if skipped.any?
  puts "=== Skipped (protected) ==="
  skipped.each do |row|
    puts "bill_order_id=#{row[0]} created_at=#{row[1]} status=#{row[2]} reason=#{row[3]} hold=#{row[4]} release=#{row[5]} debit=#{row[6]}"
  end
  puts
end

if dry_run
  puts "DRY RUN: no changes applied. Re-run with --commit to apply."
  exit 0
end

puts "=== Applying changes ==="
count = 0

BillOrder.transaction do
  expired.each do |(id, _created_at, _amt, _user_id)|
    bo = BillOrder.lock.find(id)

    # final safety re-check
    next unless bo.status.to_s == "initialized"

    hold_sum    = WalletLedgerEntry.where(bill_order_id: bo.id, entry_type: :hold).sum(:amount).to_d
    release_sum = WalletLedgerEntry.where(bill_order_id: bo.id, entry_type: :release).sum(:amount).to_d
    debit_sum   = WalletLedgerEntry.where(bill_order_id: bo.id, entry_type: :debit).sum(:amount).to_d
    next unless hold_sum == 0 && release_sum == 0 && debit_sum == 0

    bo.status = (BillOrder.statuses.key?("cancelled") ? :cancelled : :failed)
    bo.reason = "Expired / not confirmed"
    bo.save!
    count += 1
  end
end

puts "expired_count=#{count}"
puts "Done."
