def safe_count
  yield
rescue StandardError => e
  warn("[inspect_bill_order] count failed: #{e.class}: #{e.message}")
  nil
end

if defined?(WalletLedgerEntry)
  scope = WalletLedgerEntry.where(bill_order_id: bo.id)

  holds_count    = safe_count { scope.respond_to?(:hold)    ? scope.hold.count    : scope.where(entry_type: "hold").count }
  releases_count = safe_count { scope.respond_to?(:release) ? scope.release.count : scope.where(entry_type: "release").count }
  debits_count   = safe_count { scope.respond_to?(:debit)   ? scope.debit.count   : scope.where(entry_type: "debit").count }
  refunds_count  = safe_count { scope.respond_to?(:refund)  ? scope.refund.count  : scope.where(entry_type: "refund").count }

  puts({
    total: safe_count { scope.count },
    holds: holds_count,
    releases: releases_count,
    debits: debits_count,
    refunds: refunds_count
  }.inspect)
else
  puts("WalletLedgerEntry not defined")
end
