# frozen_string_literal: true

# Audit wallets where displayed balance (ledger_available_balance) looks wrong.
# Prints top suspicious wallets.

def ledger_sums(wallet_id)
  WalletLedgerEntry.where(wallet_id: wallet_id).group(:entry_type).sum(:amount).transform_keys(&:to_s)
end

rows = []

Wallet.find_each do |w|
  next unless w.respond_to?(:ledger_available_balance)

  sums = ledger_sums(w.id)
  hold   = sums["hold"].to_d
  rel    = sums["release"].to_d
  debit  = sums["debit"].to_d
  refund = sums["refund"].to_d

  outstanding = hold - rel - debit # can be negative/positive
  lab = w.ledger_available_balance.to_d

  # Suspicious case: ledger_available_balance is 0 but we have debits/holds suggesting negative pressure
  if lab == 0.to_d && (debit > 0 || hold > 0)
    rows << {
      wallet_id: w.id,
      user_id: w.user_id,
      wallet_type: w.wallet_type,
      ledger_available_balance: lab,
      hold: hold,
      release: rel,
      debit: debit,
      refund: refund,
      outstanding_raw: outstanding
    }
  end
end

puts "SUSPICIOUS COUNT: #{rows.size}"
rows.first(50).each { |r| puts r.inspect }
