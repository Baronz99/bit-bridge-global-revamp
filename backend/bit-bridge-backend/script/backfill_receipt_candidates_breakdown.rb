require "pp"

scope = Transaction
  .left_joins(:transaction_record)
  .where(
    "transaction_records.id IS NULL
     OR transaction_records.reference IS NULL
     OR transaction_records.event_type IS NULL"
  )

missing_tr = scope.where(transaction_records: { id: nil })
missing_ref = scope.where.not(transaction_records: { id: nil }).where(transaction_records: { reference: nil })
missing_event = scope.where.not(transaction_records: { id: nil }).where(transaction_records: { event_type: nil })

puts "TOTAL: #{scope.count}"
puts "missing transaction_record: #{missing_tr.count}"
puts "missing reference (record exists): #{missing_ref.count}"
puts "missing event_type (record exists): #{missing_event.count}"

puts "\nBy transaction_type (candidates):"
pp scope.reorder(nil).unscope(:order).group(:transaction_type).count

puts "\nSample (10) candidate tx rows:"
pp scope.reorder(created_at: :desc).limit(10).pluck(:id, :transaction_type, :status, :amount, :created_at)

puts "\nDup check: transaction_records per exchange_id > 1 (should be 0):"
dups = TransactionRecord.group(:exchange_id).having("COUNT(*) > 1").count
puts "dup_exchange_id_count=#{dups.size}"
pp dups.first(10)
