# frozen_string_literal: true

id = ENV.fetch("TX_ID")
t  = Transaction.find(id)

puts({
  tx_id: t.id,
  assoc_tr_id: t.transaction_record&.id,
  assoc_ref: t.transaction_record&.reference
}.inspect)

tr = TransactionRecord.where(exchange_id: id).first
puts({
  by_exchange_id: !tr.nil?,
  by_exchange_id_ref: tr&.reference
}.inspect)
