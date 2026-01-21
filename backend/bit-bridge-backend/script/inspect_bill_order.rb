# frozen_string_literal: true

def safe_count
  yield
rescue StandardError => e
  warn("[inspect_bill_order] count failed: #{e.class}: #{e.message}")
  nil
end

bill_order_id = ARGV[0].to_s.strip
if bill_order_id.empty?
  puts "Usage: rails runner script/inspect_bill_order.rb <bill_order_id>"
  exit 1
end

bo = BillOrder.find_by(id: bill_order_id)
if bo.nil?
  puts "BillOrder not found: #{bill_order_id}"
  exit 1
end
