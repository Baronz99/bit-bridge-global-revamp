# frozen_string_literal: true

wallet_id = ENV.fetch("WALLET_ID")
w = Wallet.find(wallet_id)

puts "WALLET: #{w.id} user_id=#{w.user_id} type=#{w.wallet_type}"
puts({ lab: w.ledger_available_balance, raw: (w.respond_to?(:ledger_raw_balance) ? w.ledger_raw_balance : nil), bal: w.balance }.inspect)

sums = WalletLedgerEntry.where(wallet_id: w.id).group(:entry_type).sum(:amount)
typed = sums.transform_keys { |k| WalletLedgerEntry.entry_types.key(k) || k.to_s }
puts "LEDGER SUMS: #{typed.inspect}"

puts "\nTOP DEBIT ENTRIES:"
WalletLedgerEntry.where(wallet_id: w.id, entry_type: WalletLedgerEntry.entry_types[:debit])
  .order(created_at: :desc).limit(30)
  .pluck(:id, :created_at, :amount, :bill_order_id)
  .each { |row| puts row.inspect }

puts "\nTOP HOLD ENTRIES:"
WalletLedgerEntry.where(wallet_id: w.id, entry_type: WalletLedgerEntry.entry_types[:hold])
  .order(created_at: :desc).limit(10)
  .pluck(:id, :created_at, :amount, :bill_order_id)
  .each { |row| puts row.inspect }
