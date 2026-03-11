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

const dedupeByKey = (items) => {
  const seen = new Set()
  return items.filter((item) => {
    const key = item?.key || item?.label
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const mapCatalogToAdminActions = (catalogItems = []) => {
  const mapped = catalogItems
    .filter((item) => item?.admin_route)
    .map((item) => ({
      key: item.key,
      label: item.label,
      adminAction: {
        label: `Manage ${item.label}`,
        to: item.admin_route,
      },
    }))

  return dedupeByKey([...mapped, ...FALLBACK_ADMIN_ACTIONS])
}
