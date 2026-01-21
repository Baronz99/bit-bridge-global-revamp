# frozen_string_literal: true

# Usage:
#   rails runner script/inspect_one_bill_order.rb <BILL_ORDER_ID>
#
# Example:
#   rails runner script/inspect_one_bill_order.rb e09b1a78-6e09-4bb2-971a-3941bfde7d54

require "json"

bill_order_id = ARGV[0].to_s.strip
if bill_order_id.empty?
  puts "ERROR: BillOrder ID is required."
  puts "Usage: rails runner script/inspect_one_bill_order.rb <BILL_ORDER_ID>"
  exit(1)
end

puts "=== Inspecting BillOrder ==="
bo = BillOrder.find_by(id: bill_order_id)

if bo.nil?
  puts "NOT FOUND: BillOrder id=#{bill_order_id}"
  exit(1)
end

core = {
  id: bo.id,
  status: bo.status,
  payment_method: bo.payment_method,
  payment_type: bo.payment_type,
  service_type: bo.respond_to?(:service_type) ? bo.service_type : nil,
  biller: bo.respond_to?(:biller) ? bo.biller : nil,
  meter_number: bo.respond_to?(:meter_number) ? bo.meter_number : nil,
  meter_type: bo.respond_to?(:meter_type) ? bo.meter_type : nil,
  amount: bo.amount,
  service_charge: (bo.respond_to?(:service_charge) ? bo.service_charge : nil),
  total_amount: bo.total_amount,
  user_id: bo.user_id,
  email: (bo.respond_to?(:email) ? bo.email : nil),
  phone: (bo.respond_to?(:phone) ? bo.phone : nil),
  transaction_id: (bo.respond_to?(:transaction_id) ? bo.transaction_id : nil),
  provider_reference: (bo.respond_to?(:provider_reference) ? bo.provider_reference : nil),
  idempotency_key: (bo.respond_to?(:idempotency_key) ? bo.idempotency_key : nil),
  units: (bo.respond_to?(:units) ? bo.units : nil),
  token: (bo.respond_to?(:token) ? bo.token : nil),
  reason: (bo.respond_to?(:reason) ? bo.reason : nil),
  created_at: bo.created_at,
  updated_at: bo.updated_at
}

puts core.inspect

# --- provider_response (pretty if JSON-ish, else truncated)
puts "\n=== provider_response (preview) ==="
provider_resp = bo.respond_to?(:provider_response) ? bo.provider_response : nil

if provider_resp.nil? || provider_resp.to_s.strip.empty?
  puts "(none)"
else
  raw = provider_resp.is_a?(String) ? provider_resp : provider_resp.to_json
  raw_str = raw.to_s

  # Try pretty JSON
  begin
    parsed = JSON.parse(raw_str)
    puts JSON.pretty_generate(parsed)[0, 4000] # cap output
  rescue StandardError
    puts raw_str[0, 2000] # cap output if not JSON
  end
end

# --- TransactionRecord linkage (Monnify refs etc)
puts "\n=== TransactionRecord (latest for this BillOrder) ==="
tr = TransactionRecord.where(bill_order_id: bo.id).order("created_at DESC").first
if tr.nil?
  puts "(none)"
else
  puts({
    id: tr.id,
    reference: tr.respond_to?(:reference) ? tr.reference : nil,
    status: tr.respond_to?(:status) ? tr.status : nil,
    amount: tr.respond_to?(:amount) ? tr.amount : nil,
    transaction_id: tr.respond_to?(:transaction_id) ? tr.transaction_id : nil,
    event_type: tr.respond_to?(:event_type) ? tr.event_type : nil,
    created_at: tr.created_at,
    updated_at: tr.updated_at
  }.inspect)
end

# --- Wallet ledger entries linked to this BillOrder (if you have this association)
puts "\n=== WalletLedgerEntry (counts for this BillOrder) ==="
if defined?(WalletLedgerEntry)
  scope = WalletLedgerEntry.where(bill_order_id: bo.id)
  puts({
    total: scope.count,
    holds: scope.respond_to?(:hold) ? scope.hold.count : scope.where(entry_type: "hold").count rescue nil,
    releases: scope.respond_to?(:release) ? scope.release.count : scope.where(entry_type: "release").count rescue nil,
    debits: scope.respond_to?(:debit) ? scope.debit.count : scope.where(entry_type: "debit").count rescue nil,
    refunds: scope.respond_to?(:refund) ? scope.refund.count : scope.where(entry_type: "refund").count rescue nil
  }.inspect)

  last = scope.order("created_at DESC").first
  if last
    puts "Latest entry:"
    puts last.attributes.slice("id", "entry_type", "amount", "created_at", "updated_at").inspect rescue puts last.attributes.inspect
  end
else
  puts "WalletLedgerEntry model not loaded/available."
end
