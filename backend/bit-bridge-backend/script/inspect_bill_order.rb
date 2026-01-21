if defined?(WalletLedgerEntry)
  scope = WalletLedgerEntry.where(bill_order_id: bo.id)

  holds_count =
    if scope.respond_to?(:hold)
      scope.hold.count
    else
      scope.where(entry_type: "hold").count
    end
rescue StandardError
  holds_count = nil
end

  releases_count =
    if scope.respond_to?(:release)
      scope.release.count
    else
      scope.where(entry_type: "release").count
    end
rescue StandardError
  releases_count = nil
end

  debits_count =
    if scope.respond_to?(:debit)
      scope.debit.count
    else
      scope.where(entry_type: "debit").count
    end
rescue StandardError
  debits_count = nil
end

  refunds_count =
    if scope.respond_to?(:refund)
      scope.refund.count
    else
      scope.where(entry_type: "refund").count
    end
rescue StandardError
  refunds_count = nil
end

  puts({
    total: scope.count,
    holds: holds_count,
    releases: releases_count,
    debits: debits_count,
    refunds: refunds_count
  }.inspect)
else
  puts("WalletLedgerEntry not defined")
end
