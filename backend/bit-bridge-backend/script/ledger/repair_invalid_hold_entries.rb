#!/usr/bin/env ruby
# frozen_string_literal: true

require 'optparse'

options = {
  commit: false,
  dry_run: false
}

parser = OptionParser.new do |opts|
  opts.banner = "Usage: rails runner script/ledger/repair_invalid_hold_entries.rb [--commit] [--dry-run]"

  opts.on('--commit', 'Persist compensating release entries') do
    options[:commit] = true
  end

  opts.on('--dry-run', 'Only log what would happen (default)') do
    options[:dry_run] = true
  end

  opts.on('-h', '--help', 'Show this help message') do
    puts opts
    exit
  end
end

parser.parse!(ARGV)

if options[:commit] && options[:dry_run]
  abort 'Cannot combine --commit and --dry-run. Pick one mode.'
end

commit_mode = options[:commit]
dry_run_mode = options[:dry_run] || !commit_mode
mode_label = commit_mode ? 'commit' : 'dry-run'

EXCLUDED_STATUSES = %w[completed approved].freeze

inspected = 0
invalid = 0
release_candidates = 0
release_created = 0
skipped_existing_release = 0
skipped_missing_bill_order = 0
total_repaired_amount = BigDecimal('0')

puts "[ledger_repair] Mode=#{mode_label} started at #{Time.current.iso8601}"

WalletLedgerEntry
  .holds
  .includes(:wallet, :bill_order)
  .find_each(batch_size: 500) do |hold|
  inspected += 1

  bill_order = hold.bill_order
  next if bill_order&.metadata&.[]('source') == 'anchor_transfer'
  bill_order_status = bill_order&.status

  next if bill_order_status && EXCLUDED_STATUSES.include?(bill_order_status)

  invalid += 1
  action = nil

  if bill_order.nil?
    action = 'skipped-missing-bill-order'
    skipped_missing_bill_order += 1
  else
    release_exists = WalletLedgerEntry
      .releases
      .where(wallet_id: hold.wallet_id, bill_order_id: hold.bill_order_id)
      .exists?

    if release_exists
      action = 'skipped-existing-release'
      skipped_existing_release += 1
    else
      release_candidates += 1
      repair_action = commit_mode ? 'created-release' : 'dry-run-would-release'
      action = repair_action

      if commit_mode
        WalletLedgerEntry.create!(
          wallet_id: hold.wallet_id,
          bill_order_id: hold.bill_order_id,
          entry_type: :release,
          amount: hold.amount,
          reference: "repair/auto-release/hold-#{hold.id}",
          metadata: hold.metadata.merge(
            'repair' => {
              'source_hold_id' => hold.id,
              'source_amount' => hold.amount.to_s,
              'repaired_at' => Time.current.utc.iso8601,
              'initiated_by' => 'ledger_hold_repair'
            }
          )
        )
        release_created += 1
      end

      total_repaired_amount += hold.amount.to_d
    end
  end

  puts format(
    '[ledger_repair] wallet=%s hold=%s amount=%s action=%s',
    hold.wallet_id,
    hold.id,
    hold.amount,
    action
  )
end

puts '[ledger_repair] Summary:'
puts "  inspected=#{inspected}"
puts "  invalid_holds=#{invalid}"
puts "  release_candidates=#{release_candidates}"
puts "  releases_created=#{release_created}"
puts "  skipped_existing_release=#{skipped_existing_release}"
puts "  skipped_missing_bill_order=#{skipped_missing_bill_order}"
puts "  total_repaired_amount=#{total_repaired_amount.to_f}"
puts "  mode=#{mode_label}"
