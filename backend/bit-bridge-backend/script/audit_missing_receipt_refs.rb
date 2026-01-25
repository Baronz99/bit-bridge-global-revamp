# script/audit_missing_receipt_refs.rb
require "json"

def sample_ids(scope)
  scope.limit(10).pluck(:id)
end

no_record =
  Transaction.left_joins(:transaction_record)
             .where(transaction_records: { id: nil })

record_ref_null =
  Transaction.joins(:transaction_record)
             .where(transaction_records: { reference: nil })

transfer_id_null =
  Transaction.where(transfer_id: nil)

metadata_transfer_ref_null =
  Transaction.where("metadata ->> 'transfer_reference' IS NULL")

puts JSON.pretty_generate(
  transactions_missing_receipt_references: {
    no_transaction_record: {
      count: no_record.count,
      sample_ids: sample_ids(no_record)
    },
    transaction_record_reference_null: {
      count: record_ref_null.count,
      sample_ids: sample_ids(record_ref_null)
    },
    transfer_id_null: {
      count: transfer_id_null.count,
      sample_ids: sample_ids(transfer_id_null)
    },
    metadata_transfer_reference_null: {
      count: metadata_transfer_ref_null.count,
      sample_ids: sample_ids(metadata_transfer_ref_null)
    }
  }
)
