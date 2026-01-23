# frozen_string_literal: true

require 'bigdecimal'

wallet_id = ENV['WALLET_ID'].to_s.strip
dry_run = ENV['DRY_RUN'].to_s == '1'

scope =
  if wallet_id.present?
    Wallet.where(id: wallet_id)
  else
    Wallet.where(wallet_type: :ngn)
  end

changed = []
total_adjusted = BigDecimal('0')
scanned = 0

scope.find_each do |wallet|
  scanned += 1
  raw = wallet.ledger_raw_balance.to_d
  next unless raw.negative?

  adjustment = -raw
  reference = "neg_reset:v1:#{wallet.id}:#{raw.to_s('F')}"
  metadata = {
    'source' => 'neg_reset',
    'version' => 'v1',
    'raw_before' => raw.to_f,
    'raw_after' => 0.0
  }

  if dry_run
    changed << { wallet_id: wallet.id, user_id: wallet.user_id, amount: adjustment.to_f, raw_before: raw.to_f }
  else
    WalletLedgerEntry.record_adjustment!(
      wallet: wallet,
      amount: adjustment,
      reference: reference,
      metadata: metadata
    )
    changed << { wallet_id: wallet.id, user_id: wallet.user_id, amount: adjustment.to_f, raw_before: raw.to_f }
    total_adjusted += adjustment
  end
end

puts "DRY_RUN=#{dry_run ? '1' : '0'}"
puts "SCANNED=#{scanned} CHANGED=#{changed.size}"
puts "TOTAL_ADJUSTED=#{total_adjusted.to_f}" unless dry_run
changed.first(25).each { |row| puts row.inspect }
