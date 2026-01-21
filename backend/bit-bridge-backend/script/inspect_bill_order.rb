puts "=== Inspecting specific BillOrder ==="

bo = BillOrder.find("ee3325e3-e5bc-4e93-bc6d-54f82c9a71ca")

puts({
  id: bo.id,
  status: bo.status,
  payment_method: bo.payment_method,
  payment_type: bo.payment_type,
  amount: bo.amount,
  total_amount: bo.total_amount,
  user_id: bo.user_id,
  provider_reference: bo.provider_reference,
  idempotency_key: bo.idempotency_key,
  transaction_id: bo.transaction_id,
  created_at: bo.created_at,
  updated_at: bo.updated_at
}.inspect)

puts "\n=== TransactionRecord linked to BillOrder ==="
tr = TransactionRecord.where(bill_order_id: bo.id).order("created_at DESC").first
puts(tr ? tr.attributes.inspect : "NO TRANSACTION RECORD")

puts "\n=== Latest BillOrder for user ==="
u = User.find("08dc3f30-8765-436e-8d7f-aaad7dd7b5a3")
bo2 = u.bill_orders.order("created_at DESC").first
puts({
  user: u.email,
  bill_order_id: bo2&.id,
  status: bo2&.status,
  payment_method: bo2&.payment_method,
  amount: bo2&.amount,
  created_at: bo2&.created_at
}.inspect)
