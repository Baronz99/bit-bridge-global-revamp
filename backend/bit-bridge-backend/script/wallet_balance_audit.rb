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
  adjustment = sums["adjustment"].to_d

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
      adjustment: adjustment,
      outstanding_raw: outstanding
    }
  end
end

puts "SUSPICIOUS COUNT: #{rows.size}"
rows.first(50).each { |r| puts r.inspect }

drift = []
Wallet.where(wallet_type: :ngn).find_each do |w|
  deposits = w.ledger_deposits_total.to_d
  refunds = w.ledger_refunds_total.to_d
  adjustments = w.respond_to?(:ledger_adjustments_total) ? w.ledger_adjustments_total.to_d : 0.to_d
  debits = w.ledger_debits_total.to_d

  next unless debits > (deposits + refunds + adjustments)

  drift << {
    wallet_id: w.id,
    user_id: w.user_id,
    deposits: deposits.to_f,
    refunds: refunds.to_f,
    adjustments: adjustments.to_f,
    debits: debits.to_f
  }
end

puts "DRIFT COUNT: #{drift.size}"
drift.first(50).each { |r| puts r.inspect }
