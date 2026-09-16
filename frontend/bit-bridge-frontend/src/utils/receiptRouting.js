import { resolveReceiptReference } from './receiptReference.js'

const clean = (value) => String(value ?? '').trim()

export const resolveReceiptPath = (item, options = {}) => {
  if (!item || typeof item !== 'object') return ''

  const reference = resolveReceiptReference(item, options)
  if (!reference) return ''

  const meta = item.meta && typeof item.meta === 'object' ? item.meta : {}
  const ownerType = clean(item.owner_type || meta.owner_type).toLowerCase()
  const businessEntityId = clean(item.business_entity_id || meta.business_entity_id)

  if (ownerType === 'business' && businessEntityId) {
    return `/dashboard/business/receipts/${encodeURIComponent(reference)}`
  }

  return `/dashboard/receipt/${encodeURIComponent(reference)}`
}


