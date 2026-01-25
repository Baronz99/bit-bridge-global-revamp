# frozen_string_literal: true

require "securerandom"

# Usage (DRY RUN):
#   DRY_RUN=1 BATCH=200 bundle exec rails runner script/backfill_transaction_record_references.rb
#
# Usage (REAL):
#   BATCH=200 bundle exec rails runner script/backfill_transaction_record_references.rb

BATCH  = (ENV["BATCH"] || "200").to_i
DRYRUN = ENV["DRY_RUN"].to_s == "1"

def gen_reference(date = Date.current)
  # Example: BBG-20260125-1a2b3c4d
  "BBG-#{date.strftime("%Y%m%d")}-#{SecureRandom.hex(4)}"
end

missing = Transaction
  .left_joins(:transaction_record)
  .where(transaction_records: { id: nil })
  .order(created_at: :asc)

scanned = 0
created = 0
failures = 0

puts "Backfill starting: missing_join=#{missing.count} batch=#{BATCH} dry_run=#{DRYRUN}"

missing.find_in_batches(batch_size: BATCH) do |batch|
  Transaction.transaction do
    batch.each do |tx|
      scanned += 1

      ref = nil
      10.times do
        candidate = gen_reference(tx.created_at.to_date)
        unless TransactionRecord.exists?(reference: candidate)
          ref = candidate
          break
        end
      end

      unless ref
        failures += 1
        next
      end

      if DRYRUN
        # don’t print PII; just tx id and generated reference
        puts "DRY tx=#{tx.id} ref=#{ref}"
      else
        TransactionRecord.create!(exchange_id: tx.id, reference: ref)
        created += 1
      end
    end

    raise ActiveRecord::Rollback if DRYRUN
  end
end

puts "Backfill complete: #{{
  scanned: scanned,
  created: created,
  failures: failures,
  dry_run: DRYRUN
}.inspect}"
