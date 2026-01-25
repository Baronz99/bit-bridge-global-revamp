require "json"

scope = Transaction
  .left_joins(:transaction_record)
  .where(
    "transaction_records.id IS NULL
     OR transaction_records.reference IS NULL
     OR transaction_records.event_type IS NULL"
  )

puts JSON.pretty_generate(
  total_candidates: scope.count,
  sample_ids: scope.limit(20).pluck(:id)
)
