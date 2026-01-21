# frozen_string_literal: true

STDOUT.sync = true

require "logger"

def section(title)
  puts "\n=== #{title} ==="
end

def safe
  yield
rescue StandardError => e
  puts "!! ERROR: #{e.class}: #{e.message}"
  puts e.backtrace.first(10).join("\n")
  nil
end

bill_order_id = ARGV[0].to_s.strip
if bill_order_id.empty?
  puts "Usage: rails runner script/inspect_bill_order.rb <bill_order_id>"
  exit 1
end

# Reduce noisy SQL logs so you can see the prints clearly
ActiveRecord::Base.logger&.level = Logger::WARN rescue nil

section("Script start")
puts "ARGV[0]=#{bill_order_id}"

bo = safe { BillOrder.find(bill_order_id) }
if bo.nil?
  puts "BillOrder not found"
  exit 1
end

section("BillOrder")
puts({
  id: bo.id,
  status: bo.status,
  payment_method: bo.payment_method,
  payment_type: bo.payment_type,
  service_type: (bo.respond_to?(:service_type) ? bo.service_type : nil),
  amount: bo.amount,
  total_amount: (bo.respond_to?(:total_amount) ? bo.total_amount : nil),
  user_id: bo.user_id,
  provider_reference: (bo.respond_to?(:provider_reference) ? bo.provider_reference : nil),
  transaction_id: (bo.respond_to?(:transaction_id) ? bo.transaction_id : nil),
  idempotency_key: (bo.respond_to?(:idempotency_key) ? bo.idempotency_key : nil),
  reason: (bo.respond_to?(:reason) ? bo.reason : nil),
  created_at: bo.created_at,
  updated_at: bo.updated_at
}.inspect)

section("TransactionRecord (latest for this BillOrder)")
tr = safe { TransactionRecord.where(bill_order_id: bo.id).order(created_at: :desc).first }
if tr
  puts tr.attributes.inspect
else
  puts "none"
end

section("WalletLedgerEntry (counts for this BillOrder)")
if defined?(WalletLedgerEntry)
  scope = WalletLedgerEntry.where(bill_order_id: bo.id)

  holds    = safe { scope.respond_to?(:hold)    ? scope.hold.count    : scope.where(entry_type: "hold").count }
  releases = safe { scope.respond_to?(:release) ? scope.release.count : scope.where(entry_type: "release").count }
  debits   = safe { scope.respond_to?(:debit)   ? scope.debit.count   : scope.where(entry_type: "debit").count }
  refunds  = safe { scope.respond_to?(:refund)  ? scope.refund.count  : scope.where(entry_type: "refund").count }

  puts({ total: scope.count, holds: holds, releases: releases, debits: debits, refunds: refunds }.inspect)

  last5 = safe { scope.order(created_at: :desc).limit(5).map { |e|
    {
      id: e.id,
      entry_type: (e.respond_to?(:entry_type) ? e.entry_type : nil),
      amount: (e.respond_to?(:amount) ? e.amount : nil),
      created_at: e.created_at
    }
  } }

  section("WalletLedgerEntry (last 5)")
  puts(last5 ? last5.inspect : "none")
else
  puts "WalletLedgerEntry model not available"
end

section("Provider response / token hints")
pr = bo.respond_to?(:provider_response) ? bo.provider_response : nil
if pr.nil?
  puts "provider_response: nil"
else
  puts "provider_response.class=#{pr.class}"
  if pr.is_a?(Hash)
    puts "provider_response.keys=#{pr.keys.take(50).inspect}"
    # Common token fields people use
    token_guess = pr["token"] || pr["vend_token"] || pr["data"]&.dig("token") || pr["responseBody"]&.dig("token")
    puts "token_guess=#{token_guess.inspect}"
  else
    puts pr.to_s[0, 500]
  end
end

section("Done")
puts "OK"
