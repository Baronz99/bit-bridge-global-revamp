# frozen_string_literal: true
require "json"

scope = Transaction.joins(:transaction_record).where(transaction_records: { event_type: nil })

counts = scope.group(:transaction_type).count
puts JSON.pretty_generate({
  total: scope.count,
  by_transaction_type: counts
})

# Proposed mapping counts
deposit_count = scope.where(transaction_type: "deposit").count
withdrawal_count = scope.where(transaction_type: "withdrawal").count
nil_count = scope.where(transaction_type: nil).count

puts JSON.pretty_generate({
  proposed_updates: {
    checkout_init: deposit_count,
    wallet_transaction_created: withdrawal_count + nil_count
  }
})
