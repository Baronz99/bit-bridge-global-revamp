const FALLBACK_ADMIN_ACTIONS = [
  {
    key: 'fx-settings',
    label: 'FX settings',
    adminAction: {
      label: 'Manage FX settings',
      to: '/admin/fx-settings',
    },
  },
]

const BLOCKED_ADMIN_KEYWORDS = [
  'bitcoin',
  'btc',
  'ethereum',
  'eth',
  'doge',
  'usdt',
  'usdc',
  'crypto',
  'gift card',
  'giftcard',
  'playstation store',
  'apple nigeria',
  'apple uk',
  'apple us',
]

const normalizeValue = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()

const shouldHideAdminAction = (item) => {
  const haystack = [
    item?.label,
    item?.provider,
    item?.category,
    item?.service_type,
    item?.admin_route,
    item?.key,
  ]
    .map(normalizeValue)
    .join(' ')

  return BLOCKED_ADMIN_KEYWORDS.some((keyword) => haystack.includes(keyword))
}

const buildAdminActionFamilyKey = (item) => {
  const serviceType = normalizeValue(item?.service_type)
  const category = normalizeValue(item?.category)
  const route = normalizeValue(item?.admin_route)
  const label = normalizeValue(item?.label)

  if (serviceType) return `service:${serviceType}`
  if (category) return `category:${category}`
  if (route) return `route:${route}`
  if (label) return `label:${label}`
  return normalizeValue(item?.key)
}

const dedupeAdminActions = (items) => {
  const seen = new Set()
  return items.filter((item) => {
    const key = item?.familyKey || item?.adminAction?.to || item?.key || item?.label
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const mapCatalogToAdminActions = (catalogItems = []) => {
  const mapped = catalogItems
    .filter((item) => item?.admin_route)
    .filter((item) => !shouldHideAdminAction(item))
    .map((item) => ({
      key: item.key,
      familyKey: buildAdminActionFamilyKey(item),
      label: item.label,
      adminAction: {
        label: `Manage ${item.label}`,
        to: item.admin_route,
      },
    }))

  return dedupeAdminActions([...mapped, ...FALLBACK_ADMIN_ACTIONS])
}
