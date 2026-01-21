# frozen_string_literal: true

require "json"

def sum_ledger(wallet, type)
  WalletLedgerEntry.where(wallet_id: wallet.id, entry_type: type).sum(:amount).to_d
end

def inspect_wallet(user_id, wallet_id = nil)
  u = User.find(user_id)
  w = wallet_id.present? ? Wallet.find(wallet_id) : u.wallet

  deposits_amount = Transaction.where(wallet_id: w.id, transaction_type: :deposit, status: :approved).sum(:amount).to_d
  deposits_bonus  = Transaction.where(wallet_id: w.id, transaction_type: :deposit, status: :approved).sum(:bonus).to_d
  deposits = deposits_amount + deposits_bonus

  withdrawals = Transaction.where(wallet_id: w.id, transaction_type: :withdrawal, status: [:pending, :approved]).sum(:amount).to_d

  holds    = sum_ledger(w, :hold)
  releases = sum_ledger(w, :release)
  debits   = sum_ledger(w, :debit)
  refunds  = sum_ledger(w, :refund)

  # "Outstanding hold" estimate (depends on your ledger semantics)
  outstanding_hold = holds - releases - debits

  pending_wallet_bill_orders = BillOrder.where(
    user_id: u.id,
    payment_method: :wallet,
    status: [:initialized, :processing]
  ).sum(:total_amount).to_d

  computed_available = deposits - withdrawals - outstanding_hold - pending_wallet_bill_orders

  puts "\n=== Wallet Balance Breakdown ==="
  puts({
    user_id: u.id,
    wallet_id: w.id,
    deposits_approved_total: deposits,
    withdrawals_pending_or_approved_total: withdrawals,
    ledger_holds_total: holds,
    ledger_releases_total: releases,
    ledger_debits_total: debits,
    ledger_refunds_total: refunds,
    outstanding_hold_estimate: outstanding_hold,
    pending_wallet_bill_orders_total: pending_wallet_bill_orders,
    computed_available_estimate: computed_available
  }.inspect)

  puts "\n=== Latest 10 ledger entries ==="
  puts WalletLedgerEntry.where(wallet_id: w.id).order(created_at: :desc).limit(10).pluck(:created_at, :entry_type, :amount, :bill_order_id).map { |r|
    { created_at: r[0], entry_type: r[1], amount: r[2], bill_order_id: r[3] }
  }.inspect

  puts "\n=== Latest 10 transactions ==="
  puts Transaction.where(wallet_id: w.id).order(created_at: :desc).limit(10).pluck(:created_at, :transaction_type, :status, :amount, :bonus).map { |r|
    { created_at: r[0], type: r[1], status: r[2], amount: r[3], bonus: r[4] }
  }.inspect

  puts "\n=== Pending wallet bill_orders (initialized/processing) ==="
  puts BillOrder.where(user_id: u.id, payment_method: :wallet, status: [:initialized, :processing])
    .order(created_at: :desc).limit(10)
    .pluck(:id, :status, :total_amount, :reason, :created_at).map { |r|
      { id: r[0], status: r[1], total_amount: r[2], reason: r[3], created_at: r[4] }
    }.inspect
end

def parse_provider_payload(val)
  return nil if val.nil?
  return val if val.is_a?(Hash)
  return JSON.parse(val) rescue nil if val.is_a?(String)
  val
end

mode = ARGV[0].to_s

case mode
when "wallet"
  user_id = ARGV[1]
  wallet_id = ARGV[2]
  raise "Usage: rails runner script/inspect_bill_order.rb wallet <user_id> [wallet_id]" if user_id.blank?
  inspect_wallet(user_id, wallet_id)

when "insufficient"
  bill_order_id = ARGV[1]
  raise "Usage: rails runner script/inspect_bill_order.rb insufficient <bill_order_id>" if bill_order_id.blank?
  bo = BillOrder.find(bill_order_id)

  puts "\n=== BillOrder (insufficient helper) ==="
  puts({ id: bo.id, status: bo.status, total_amount: bo.total_amount, reason: bo.reason, user_id: bo.user_id }.inspect)

  payload = parse_provider_payload(bo.provider_response)
  puts "\n=== provider_response parsed ==="
  puts({ class: payload.class.name, keys: (payload.is_a?(Hash) ? payload.keys : nil), raw: payload }.inspect)

  inspect_wallet(bo.user_id, bo.user.wallet.id)

else
  # keep your existing behavior for bill_order inspection
  # (your current code should already run here)
end
