# script/backfill_receipt_references.rb
# Usage:
#   DRY_RUN=1 bundle exec rails runner script/backfill_receipt_references.rb
#   bundle exec rails runner script/backfill_receipt_references.rb
#
# Optional:
#   BATCH=500 bundle exec rails runner script/backfill_receipt_references.rb

require "securerandom"

dry_run = ENV["DRY_RUN"] == "1"
batch_size = (ENV["BATCH"] || "500").to_i

stats = {
  scanned: 0,
  tx_records_created: 0,
  references_set: 0,
  skipped_already_ok: 0,
  collisions_retried: 0,
  failures: 0
}

def present_str?(v)
  v.is_a?(String) && v.strip.length > 0
end

def generate_reference
  "BBG-#{Time.now.utc.strftime('%Y%m%d')}-#{SecureRandom.hex(4)}"
end

Transaction.includes(:transaction_record).find_in_batches(batch_size: batch_size) do |batch|
  batch.each do |txn|
    stats[:scanned] += 1
    tr = txn.transaction_record

    if tr && present_str?(tr.reference)
      stats[:skipped_already_ok] += 1
      next
    end

    if tr.nil?
      if dry_run
        stats[:tx_records_created] += 1
      else
        tr = txn.create_transaction_record!(status: "pending")
        stats[:tx_records_created] += 1
      end
    else
      if tr.status.nil? && !dry_run
        tr.update!(status: "pending")
      end
    end

    meta = txn.metadata.is_a?(Hash) ? txn.metadata : {}
    candidate =
      meta["transfer_reference"] ||
      meta["transaction_reference"] ||
      txn.transfer_id

    candidate = generate_reference unless present_str?(candidate)

    retries = 0
    while TransactionRecord.where(reference: candidate).exists?
      retries += 1
      stats[:collisions_retried] += 1
      candidate = generate_reference
      if retries >= 10
        stats[:failures] += 1
        puts "[FAIL] Collision retries exceeded for txn_id=#{txn.id}"
        candidate = nil
        break
      end
    end

    next if candidate.nil?

    if dry_run
      stats[:references_set] += 1
      next
    end

    begin
      tr.update!(reference: candidate)
      stats[:references_set] += 1
    rescue => e
      stats[:failures] += 1
      puts "[FAIL] txn_id=#{txn.id} error=#{e.class}: #{e.message}"
    end
  end
end

puts "Backfill receipt references complete"
puts stats.inspect
