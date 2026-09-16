const RECEIPT_PREFIXES = ['bbg-', 'fbg-', 'trx-', 'txn-', 'bill-', 'trf-', 'wallet-tx-', 'card-evt-', 'circle-tx-']

const clean = (value) => String(value ?? '').trim()
const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const sumFees = (fees) =>
  Array.isArray(fees)
    ? fees.reduce((sum, fee) => sum + (toNumber(fee?.amount) || 0), 0)
    : null

export const fallbackValue = (value) => (value === null || value === undefined || value === '' ? 'Not available' : value)

export const normalizeTimelineItem = (item) => {
  if (!item || typeof item !== 'object') return null
  const state = String(item.state || item.status || 'pending').toLowerCase()
  return {
    label: item.label || item.event_type || item.step_key || 'Update',
    description: item.description || '',
    status: state,
    occurred_at: item.occurred_at || item.created_at || null,
  }
}

export const normalizeReceiptPayload = (raw, fallbackReference = '', fallbackTitle = 'Transaction receipt') => {
  const payload = raw && typeof raw === 'object' ? raw : {}
  const financials = payload.financials && typeof payload.financials === 'object' ? payload.financials : null
  const fees = Array.isArray(financials?.fees) ? financials.fees : Array.isArray(payload.fees) ? payload.fees : []
  const computedFee = financials?.total_fees ?? payload.fee ?? sumFees(fees)
  const amount =
    toNumber(financials?.value_amount) ??
    toNumber(payload.value_amount) ??
    toNumber(payload.amount) ??
    toNumber(payload.wallet_amount_charged) ??
    toNumber(payload.total_display)
  const fee = toNumber(computedFee)
  const total =
    toNumber(financials?.total_debit) ??
    toNumber(payload.total_amount) ??
    toNumber(payload.total) ??
    toNumber(payload.total_display) ??
    toNumber(payload.wallet_amount_charged) ??
    (amount !== null && fee !== null ? amount + fee : null)

  const providerRaw = payload.provider
  const provider =
    typeof providerRaw === 'string'
      ? { name: providerRaw }
      : providerRaw && typeof providerRaw === 'object'
        ? {
            ...providerRaw,
            reference: providerRaw.reference || providerRaw.transaction_reference || providerRaw.external_reference || null,
          }
        : {}

  const timeline = Array.isArray(payload.timeline)
    ? payload.timeline.map(normalizeTimelineItem).filter(Boolean)
    : []

  return {
    ...payload,
    reference: payload.reference || fallbackReference,
    title: payload.title || payload.description || fallbackTitle,
    subtitle: payload.subtitle || payload.description || '',
    created_at: payload.created_at || payload.recorded_at || payload.occurred_at || payload.updated_at || null,
    amount,
    fee,
    total,
    fees,
    financials,
    provider,
    timeline,
  }
}

export const isCanonicalReceiptReference = (value) => {
  const normalized = clean(value).toLowerCase()
  if (!normalized) return false
  return RECEIPT_PREFIXES.some((prefix) => normalized.startsWith(prefix))
}

export const resolveReceiptPresentation = (receipt) => {
  const kind = clean(receipt?.receipt_kind).toLowerCase() || 'transaction'
  const transactionType = clean(receipt?.transaction_type).toLowerCase()
  const ownerType = clean(receipt?.owner_type).toLowerCase() || 'personal'

  const contextLabel =
    ownerType === 'business' ? 'Business' : ownerType === 'circle' ? 'Circle' : 'Personal'

  if (kind === 'transfer') {
    return {
      kind: 'transfer',
      headerTitle: 'Transfer receipt',
      contextLabel,
      detailLabel: 'Transfer details',
      failedMessage: 'This transfer failed. Contact support with the receipt reference if this persists.',
    }
  }

  if (kind === 'electricity') {
    return {
      kind: 'electricity',
      headerTitle: 'Electricity receipt',
      contextLabel,
      detailLabel: 'Bill details',
      failedMessage: 'This electricity payment failed. If debited, reversal is in progress.',
    }
  }

  if (kind === 'bill') {
    return {
      kind: 'bill',
      headerTitle: 'Bill payment receipt',
      contextLabel,
      detailLabel: 'Bill details',
      failedMessage: 'This bill payment failed. If debited, reversal is in progress.',
    }
  }

  if (kind === 'card') {
    return {
      kind: 'card',
      headerTitle: 'Card receipt',
      contextLabel,
      detailLabel: 'Card details',
      failedMessage: 'This card transaction failed. Contact support if this persists.',
    }
  }

  if (kind === 'circle') {
    return {
      kind: 'circle',
      headerTitle: 'Circle receipt',
      contextLabel,
      detailLabel: 'Circle details',
      failedMessage: 'This circle transaction failed. Contact support if this persists.',
    }
  }

  if (transactionType === 'deposit') {
    return {
      kind: 'transaction',
      headerTitle: 'Wallet funding receipt',
      contextLabel,
      detailLabel: 'Funding details',
      failedMessage: 'This wallet funding failed. Contact support if this persists.',
    }
  }

  if (transactionType === 'withdrawal') {
    return {
      kind: 'transaction',
      headerTitle: 'Withdrawal receipt',
      contextLabel,
      detailLabel: 'Withdrawal details',
      failedMessage: 'This withdrawal failed. Contact support if this persists.',
    }
  }

  return {
    kind: 'transaction',
    headerTitle: 'Transaction receipt',
    contextLabel,
    detailLabel: 'Transaction details',
    failedMessage: 'This transaction failed. Contact support if this persists.',
  }
}

export const contextChipClassName = (receipt) => {
  const ownerType = clean(receipt?.owner_type).toLowerCase()
  if (ownerType === 'business') return 'bg-cyan-500/12 text-cyan-200 border border-cyan-500/25'
  if (ownerType === 'circle') return 'bg-sky-500/12 text-sky-200 border border-sky-500/25'
  return 'bg-emerald-500/12 text-emerald-200 border border-emerald-500/25'
}
