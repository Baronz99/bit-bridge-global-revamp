export const BRIDGE_UTILITY_SERVICE_TYPES = ['VTU', 'DATA', 'TV', 'ELECTRICITY']

const normalizeText = (value) => String(value || '').trim()

export const adaptCatalogItemToProvisionLike = (item) => {
  const provider = normalizeText(item?.provider)
  const label = normalizeText(item?.label)
  const serviceType = normalizeText(item?.service_type).toUpperCase()

  return {
    id: item?.provision_id ?? item?.id,
    name: provider || label,
    description: label || provider,
    service_type: serviceType,
    product: {
      id: item?.product_id,
      provider,
      description: label || provider,
    },
    catalog: item,
  }
}

export const filterBridgeUtilityCatalog = (items = [], allowedServiceTypes = BRIDGE_UTILITY_SERVICE_TYPES) => {
  const allowed = new Set(allowedServiceTypes.map((item) => normalizeText(item).toUpperCase()))

  return items
    .filter((item) => allowed.has(normalizeText(item?.service_type).toUpperCase()))
    .map(adaptCatalogItemToProvisionLike)
    .filter((item) => item.id != null && item.product?.provider)
}

export const groupBridgeUtilityCatalog = (items = []) => {
  const adapted = filterBridgeUtilityCatalog(items)

  return {
    all: adapted,
    airtime: adapted.filter((item) => item.service_type === 'VTU'),
    dataBundles: adapted.filter((item) => item.service_type === 'DATA'),
    utilities: adapted.filter((item) => item.service_type === 'TV' || item.service_type === 'ELECTRICITY'),
    mobileProviders: adapted.filter((item) => item.service_type === 'VTU' || item.service_type === 'DATA'),
  }
}
