ref='fbg-1769478185'
tr=TransactionRecord.find_by(reference: ref)
tx=tr ? tr.exchange : nil
puts({ref: ref, tr_id: (tr ? tr.id : nil), tr_status: (tr ? tr.status : nil), tr_event_type: (tr ? tr.event_type : nil), tr_txn_id: (tr ? tr.transaction_id : nil), exchange_id: (tx ? tx.id : nil), exchange_status: (tx ? tx.status : nil), exchange_amount: (tx ? tx.amount : nil), exchange_type: (tx ? tx.transaction_type : nil), updated_at: (tr ? tr.updated_at : nil)}.inspect)
