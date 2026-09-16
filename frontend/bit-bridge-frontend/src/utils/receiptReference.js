const RECEIPT_PREFIXES = ['bbg-', 'fbg-', 'trx-', 'txn-', 'bill-', 'trf-', 'wallet-tx-', 'card-evt-', 'circle-tx-']

const clean = (value) => String(value ?? '').trim()

const hasReceiptPrefix = (value) => {
  const normalized = clean(value).toLowerCase()
  return RECEIPT_PREFIXES.some((prefix) => normalized.startsWith(prefix))
}

const firstString = (...values) => {
  for (const value of values) {
    const text = clean(value)
    if (text) return text
  }
  return ''
}

export const resolveReceiptReference = (item, options = {}) => {
  if (!item || typeof item !== 'object') return ''

  const meta = item.meta && typeof item.meta === 'object' ? item.meta : {}
  const txRecord =
    item.transaction_record && typeof item.transaction_record === 'object' ? item.transaction_record : {}
  const provider = item.provider && typeof item.provider === 'object' ? item.provider : {}

  const candidates = [
    item.receipt_reference,
    item.transaction_record_reference,
    txRecord.reference,
    item.reference,
    item.transaction_reference,
    item.payment_reference,
    provider.reference,
    item.provider_reference,
    item.unique_transaction_id,
    item.transfer_reference,
    item.wallet_transaction_reference,
    meta.transaction_record_reference,
    meta.reference,
    meta.payment_reference,
  ]

  for (const value of candidates) {
    const text = clean(value)
    if (hasReceiptPrefix(text)) return text
  }

  const id = clean(item.id)
  if (!id) return ''
  if (hasReceiptPrefix(id)) return id

  const kindHint = clean(options.kindHint).toLowerCase()
  const kind = firstString(item.kind, item.type, kindHint).toLowerCase()
  if (kind.includes('bill') || kindHint === 'bill') return `bill-${id}`
  if (kind.includes('card') || kindHint === 'card') return `card-evt-${id}`
  if (kind.includes('wallet') || kindHint === 'wallet') return `wallet-tx-${id}`
  if (kind.includes('circle') || kindHint === 'circle') return `circle-tx-${id}`

  if (options.preferWallet) return `wallet-tx-${id}`
  return ''
}
