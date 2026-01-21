# frozen_string_literal: true

id = ARGV[0]
raise "BillOrder ID required" if id.blank?

puts "=== Reconcile start ==="
puts "bill_order_id=#{id}"

order = BillOrder.find(id)
puts "Before: status=#{order.status}, reason=#{order.reason.inspect}"

BuyPowerReconcileJob.perform_now(id)

order.reload
puts "After: status=#{order.status}, reason=#{order.reason.inspect}"

puts "=== Reconcile end ==="
