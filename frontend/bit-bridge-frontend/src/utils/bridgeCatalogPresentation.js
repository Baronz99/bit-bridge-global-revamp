const BRIDGE_SERVICE_PRESENTATION = Object.freeze({
  VTU: {
    label: 'Buy airtime',
    title: 'Airtime',
    detail: 'Top up supported mobile networks directly from your NGN wallet.',
    route: '/dashboard/utilities/mobile-top-up',
    iconKey: 'mobile',
    accent: 'from-emerald-500/12 to-transparent',
    border: 'border-emerald-500/25',
    iconWrap: 'bg-emerald-500/12 text-emerald-300',
    button: 'text-emerald-300',
  },
  DATA: {
    label: 'Buy data',
    title: 'Data Bundles',
    detail: 'Buy mobile data plans from available network providers.',
    route: '/dashboard/utilities/mobile-top-up',
    iconKey: 'wifi',
    accent: 'from-fuchsia-500/12 to-transparent',
    border: 'border-fuchsia-500/25',
    iconWrap: 'bg-fuchsia-500/12 text-fuchsia-300',
    button: 'text-fuchsia-300',
  },
  TV: {
    label: 'Pay TV',
    title: 'Cable TV',
    detail: 'Renew DSTV, GOTV, Startimes, and other TV subscriptions.',
    route: '/dashboard/utilities/cable',
    iconKey: 'tv',
    accent: 'from-sky-500/12 to-transparent',
    border: 'border-sky-500/25',
    iconWrap: 'bg-sky-500/12 text-sky-300',
    button: 'text-sky-300',
  },
  ELECTRICITY: {
    label: 'Pay electricity',
    title: 'Electricity',
    detail: 'Pay for prepaid and postpaid meter tokens from supported discos.',
    route: '/dashboard/utilities/buy-power',
    iconKey: 'lightning',
    accent: 'from-amber-500/12 to-transparent',
    border: 'border-amber-500/25',
    iconWrap: 'bg-amber-500/12 text-amber-300',
    button: 'text-amber-300',
  },
  UTILITY: {
    label: 'Open utilities',
    title: 'Utilities',
    detail: 'Open the local utility workspace for active service providers.',
    route: '/dashboard/bridge/utilities',
  },
})

export const BRIDGE_PRODUCT_SERVICE_TYPES = Object.freeze(Object.keys(BRIDGE_SERVICE_PRESENTATION))

export const BRIDGE_UTILITY_CARD_TYPES = Object.freeze(
  BRIDGE_PRODUCT_SERVICE_TYPES.filter((serviceType) => serviceType !== 'UTILITY')
)

export const getBridgeServicePresentation = (serviceType) => {
  const key = String(serviceType || '').toUpperCase()
  return BRIDGE_SERVICE_PRESENTATION[key] || null
}

export const isBridgeCatalogServiceType = (serviceType) =>
  BRIDGE_PRODUCT_SERVICE_TYPES.includes(String(serviceType || '').toUpperCase())
