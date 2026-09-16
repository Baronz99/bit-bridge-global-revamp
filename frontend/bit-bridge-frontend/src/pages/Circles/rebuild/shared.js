import { getCircleRoleLabel as getMappedCircleRoleLabel } from '../roleLabels'

const asObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {})
const asArray = (value) => (Array.isArray(value) ? value : [])
const DEFAULT_CADENCE = 'monthly'
const clearedDuesStatuses = new Set(['paid', 'waived'])

const cadenceUnit = (cadence) => {
  switch (String(cadence || DEFAULT_CADENCE).toLowerCase()) {
    case 'weekly':
      return 'week'
    case 'yearly':
      return 'year'
    default:
      return 'month'
  }
}

export const formatPeriodCountLabel = (count, cadence) => {
  const total = Math.max(Number(count || 0), 0)
  const unit = cadenceUnit(cadence)
  return `${total} ${unit}${total === 1 ? '' : 's'}`
}

export const formatCadenceLabel = (cadence) =>
  cadenceUnit(cadence).replace(/^./, (match) => match.toUpperCase())

export const formatMoney = (value, currency = 'NGN') => {
  const amount = Number(value || 0) / 100
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `NGN ${amount.toLocaleString()}`
  }
}

export const formatDateLabel = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-NG', {
    month: 'short',
    day: 'numeric',
  })
}

export const formatDateTimeLabel = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('en-NG', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const getContributionStatusMeta = ({ status, duePlanConfigured }) => {
  const normalized = String(status || '').toLowerCase()
  if (!duePlanConfigured) return { label: 'No dues configured', tone: 'slate' }
  if (normalized === 'paid' || normalized === 'waived' || normalized === 'current') {
    return { label: 'Paid', tone: 'emerald' }
  }
  if (normalized === 'pending' || normalized === 'overdue') {
    return { label: 'Owing', tone: 'amber' }
  }
  if (normalized === 'not_due') {
    return { label: 'No current dues', tone: 'slate' }
  }

  return { label: 'No current dues', tone: 'slate' }
}

export const formatContributionStatusLabel = (status, options = {}) =>
  getContributionStatusMeta({ status, duePlanConfigured: options.duePlanConfigured }).label

export const getContributionStatusTone = (status, options = {}) =>
  getContributionStatusMeta({ status, duePlanConfigured: options.duePlanConfigured }).tone

export const getCircleTitle = (workspace) =>
  String(workspace?.name || workspace?.title || workspace?.circle_name || 'Circle').trim()

export const getCircleRoleLabel = (workspace) => getMappedCircleRoleLabel(workspace)

export const getCircleBucketLabel = (workspace) =>
  String(workspace?.product_bucket_label || workspace?.bucket_label || workspace?.type_label || '')
    .trim()

export const normalizePaymentItems = (payload) => {
  const root = payload?.data ?? payload
  if (Array.isArray(root?.data)) return root.data
  if (Array.isArray(root)) return root
  return []
}

export const normalizeDueObligations = (payload) => {
  const root = payload?.data ?? payload
  if (Array.isArray(root?.data)) return root.data
  if (Array.isArray(root)) return root
  return []
}

export const normalizeDueSummary = (payload) => {
  const root = payload?.data ?? payload
  return root && typeof root === 'object' && !Array.isArray(root) ? root : {}
}

export const getCurrentUserDueSummary = (payload) => {
  const summary = normalizeDueSummary(payload)
  return summary?.current_user_summary && typeof summary.current_user_summary === 'object'
    ? summary.current_user_summary
    : {}
}

export const buildMemberDuesLookup = (members, obligations, duePlan) => {
  const cadence = duePlan?.cadence
  const entries = new Map()

  normalizeDueObligations(obligations).forEach((item) => {
    const userId = String(item?.user_id || '').trim()
    if (!userId) return
    entries.set(userId, item)
  })

  return (Array.isArray(members) ? members : []).reduce((accumulator, member) => {
    const userId = String(member?.user?.id || member?.user_id || '').trim()
    const membershipId = String(member?.id || userId).trim()
    const obligation = entries.get(userId)
    if (!membershipId || !obligation) return accumulator

    const status = String(obligation?.status || '').toLowerCase()
    const isCleared = clearedDuesStatuses.has(status)
    const outstandingAmountCents = Math.max(Number(isCleared ? 0 : obligation?.amount_cents || 0), 0)
    const periodsPaidCount = isCleared ? 1 : 0

    accumulator[membershipId] = {
      statusKey: isCleared ? 'paid' : 'owing',
      statusLabel: isCleared ? 'Paid' : 'Owing',
      periodsPaidCount,
      periodsPaidLabel: `${formatPeriodCountLabel(periodsPaidCount, cadence)} paid`,
      outstandingAmountCents,
      outstandingAmountLabel: formatMoney(
        outstandingAmountCents,
        obligation?.currency || duePlan?.currency || 'NGN'
      ),
      helperLabel: isCleared
        ? `${formatPeriodCountLabel(periodsPaidCount, cadence)} paid`
        : `${formatMoney(outstandingAmountCents, obligation?.currency || duePlan?.currency || 'NGN')} owing`,
    }
    return accumulator
  }, {})
}

export const getPaymentPurposeLabel = (item) => {
  const title = String(item?.title || '').trim()
  const normalizedType = String(item?.type || '').toLowerCase()
  const checkoutMode = String(item?.payment_item_kind || item?.checkout_mode || item?.item_type || '').toLowerCase()

  if (item?.linked_reference_type === 'CircleDuePlan' || normalizedType === 'dues' || checkoutMode === 'recurring') {
    return 'dues'
  }
  if (normalizedType === 'treasury_topup' || item?.support_fallback) {
    return 'treasury contribution'
  }
  if (/fine|penalt/i.test(title)) return 'fine'
  if (item?.linked_reference_type === 'CircleActivity' || normalizedType === 'activity_goal') {
    return 'collection contribution'
  }
  if (/event|support|special|one[- ]off|emergency|welfare|contribution|levy|fund|bill|fee|maintenance|match|jersey/i.test(title)) {
    return 'collection contribution'
  }
  return 'contribution'
}

export const getPaymentItemTypeLabel = (item) => {
  const purpose = getPaymentPurposeLabel(item)
  if (purpose === 'dues') return 'Dues'
  if (purpose === 'fine') return 'Fine'
  if (purpose === 'collection contribution') return 'Collection'
  if (purpose === 'treasury contribution') return 'Treasury Contribution'
  return 'Contribution'
}

export const getPaymentItemTitleLabel = (item) => {
  const title = String(item?.title || '').trim()
  const normalizedType = String(item?.type || '').toLowerCase()
  if (normalizedType === 'treasury_topup' || item?.support_fallback || /^general support$/i.test(title)) {
    return 'Treasury Contribution'
  }
  return title || getPaymentItemTypeLabel(item)
}

export const getPaymentItemStatusBadge = (item) => {
  const status = String(item?.status || '').toLowerCase()
  if (status.includes('overdue')) return { label: 'Overdue', tone: 'rose' }
  if (status.includes('due')) return { label: 'Due now', tone: 'amber' }
  if (status.includes('current') || status.includes('paid')) return { label: 'Paid up', tone: 'emerald' }
  if (status.includes('upcoming') || status.includes('not_enrolled') || status.includes('review')) {
    return { label: 'Upcoming', tone: 'slate' }
  }
  if (String(item?.type || '').toLowerCase() === 'treasury_topup' || item?.support_fallback) {
    return { label: 'Optional', tone: 'sky' }
  }
  return { label: item?.is_payable_now === false ? 'Review only' : 'Optional', tone: 'slate' }
}

export const getPaymentItemAmountLabel = (item) => {
  const checkoutMode = String(item?.payment_item_kind || item?.checkout_mode || item?.item_type || '').toLowerCase()
  if (checkoutMode === 'quantity') {
    if (item?.unit_price_cents) return `${formatMoney(item.unit_price_cents)} each`
    if (item?.amount_cents) return formatMoney(item.amount_cents)
  }
  if (checkoutMode === 'fixed') {
    if (item?.amount_cents) return formatMoney(item.amount_cents)
    if (item?.unit_price_cents) return formatMoney(item.unit_price_cents)
  }
  if (checkoutMode === 'recurring') {
    const cadence = cadenceUnit(item?.cadence)
    if (item?.amount_cents) return `${formatMoney(item.amount_cents)} / ${cadence}`
    if (item?.suggested_amount_cents) return `From ${formatMoney(item.suggested_amount_cents)} / ${cadence}`
    return `${formatCadenceLabel(item?.cadence)} dues`
  }
  if (item?.unit_price_cents) return formatMoney(item.unit_price_cents)
  if (item?.amount_cents) return formatMoney(item.amount_cents)
  if (item?.suggested_amount_cents) return `Suggested ${formatMoney(item.suggested_amount_cents)}`
  return 'Open amount'
}

export const getPaymentItemMetaLabel = (item) => {
  const checkoutMode = String(item?.payment_item_kind || item?.checkout_mode || item?.item_type || '').toLowerCase()
  if (checkoutMode === 'recurring') {
    const cadence = formatCadenceLabel(item?.cadence)
    return item?.due_on ? `${cadence} dues - Next ${formatDateLabel(item.due_on)}` : `${cadence} dues`
  }
  const typeLabel = getPaymentItemTypeLabel(item)
  if (checkoutMode === 'fixed') return item?.due_on ? `${typeLabel} - Due ${formatDateLabel(item.due_on)}` : typeLabel
  if (checkoutMode === 'quantity') return `${typeLabel} - Quantity based`
  if (checkoutMode === 'open') return typeLabel
  if (item?.support_fallback) return 'Treasury Contribution'
  return item?.due_on ? `${typeLabel} - ${formatDateLabel(item.due_on)}` : typeLabel
}

export const getPaymentItemCheckoutMode = (item) =>
  String(item?.payment_item_kind || item?.checkout_mode || item?.item_type || '').toLowerCase()

export const getPaymentItemCallToAction = (item, options = {}) => {
  const quantity = Math.max(Number(options.quantity || 0), 0)
  const purpose = getPaymentPurposeLabel(item)
  if (purpose === 'dues') {
    if (quantity > 0) return `Pay ${formatPeriodCountLabel(quantity, item?.cadence)} Dues`
    return 'Pay Dues'
  }
  if (purpose === 'fine') return 'Pay Fine'
  if (purpose === 'collection contribution') return 'Contribute to Collection'
  if (purpose === 'treasury contribution') return 'Contribute to Treasury'
  return 'Contribute'
}

const getActorDisplayName = (record) => {
  const actor = asObject(record?.actor)
  const displayName =
    String(
      actor.display_name ||
        actor.name ||
        actor.fallback_name ||
        record?.actor_name ||
        record?.user_name ||
        record?.performed_by ||
        ''
    ).trim()

  return displayName || 'Member'
}

export const getPaymentEventLabel = (record) => {
  const actor = getActorDisplayName(record)
  const backendLabel = String(record?.label || record?.display_message || '').trim()
  if (backendLabel) {
    const normalizedBackendLabel = backendLabel.toLowerCase()
    if (
      normalizedBackendLabel.includes('general support') ||
      normalizedBackendLabel.includes('treasury top-up') ||
      normalizedBackendLabel.includes('top up treasury')
    ) {
      return `${actor} made a treasury contribution`
    }
    if (
      normalizedBackendLabel.includes('goal contribution') ||
      normalizedBackendLabel.includes('event contribution') ||
      normalizedBackendLabel.includes('collection contribution')
    ) {
      return `${actor} contributed to a collection`
    }
    if (/^(paid|withdrew|requested|approved|rejected|contributed|funded|topped up|received)/i.test(backendLabel)) {
      return `${actor} ${backendLabel}`.trim()
    }
    return backendLabel
  }
  const itemTitle =
    String(record?.payment_item_title || record?.payment_purpose_label || record?.purpose_label || '').trim()
  const purpose = String(record?.payment_purpose || record?.payment_purpose_label || '').toLowerCase()
  if (purpose === 'treasury_topup' || purpose === 'treasury contribution') {
    return `${actor} made a treasury contribution`
  }
  if (purpose === 'activity_goal' || purpose === 'collection contribution') {
    return itemTitle ? `${actor} contributed to ${itemTitle}` : `${actor} contributed to a collection`
  }
  const quantity = Number(record?.payment_item_quantity || record?.meta?.payment_item_quantity || 0)
  if (itemTitle && quantity > 0) {
    const pluralSuffix = itemTitle.endsWith('s') ? '' : 's'
    return `${actor} paid ${quantity} ${itemTitle}${quantity === 1 ? '' : pluralSuffix}`
  }
  if (itemTitle) return `${actor} paid ${itemTitle}`
  const message =
    String(record?.message || record?.title || record?.description || '').trim()
  return message || `${actor} moved money in the circle`
}

export const getReceiptRoute = (record) => {
  const reference = String(
    record?.reference || record?.transaction_reference || record?.receipt_reference || ''
  ).trim()
  return reference ? `/dashboard/receipt/${encodeURIComponent(reference)}` : null
}

export const getRecentRecords = (workspace) =>
  asArray(asObject(workspace?.recent_activity).items).length
    ? asArray(asObject(workspace?.recent_activity).items)
    : asArray(workspace?.recent_transactions)
