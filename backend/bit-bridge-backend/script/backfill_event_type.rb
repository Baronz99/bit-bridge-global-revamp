# frozen_string_literal: true

BATCH_SIZE = (ENV["BATCH_SIZE"] || "200").to_i

def backfill!(tx_type:, event_type:)
  scope = Transaction
    .joins(:transaction_record)
    .where(transaction_records: { event_type: nil })
    .where(transaction_type: tx_type)

  total = scope.count
  puts({ step: "start", tx_type: tx_type, event_type: event_type, total: total, batch_size: BATCH_SIZE }.inspect)

  updated = 0

  loop do
    ids = scope.limit(BATCH_SIZE).pluck("transaction_records.id")
    break if ids.empty?

    n = TransactionRecord.where(id: ids).update_all(event_type: event_type, updated_at: Time.current)
    updated += n

    puts({ step: "batch", tx_type: tx_type, event_type: event_type, updated: n, updated_so_far: updated }.inspect)
  end

  puts({ step: "done", tx_type: tx_type, event_type: event_type, updated_total: updated }.inspect)
end

# Deposits -> checkout.init
backfill!(tx_type: "deposit", event_type: "checkout.init")

# Withdrawals + nil tx type -> wallet.transaction.created
backfill!(tx_type: "withdrawal", event_type: "wallet.transaction.created")
backfill!(tx_type: nil, event_type: "wallet.transaction.created")

remaining = TransactionRecord.where(event_type: nil).count
puts({ remaining_null_event_type: remaining }.inspect)
