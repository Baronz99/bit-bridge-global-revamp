import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PiDeviceMobileBold,
  PiLightningBold,
  PiTelevisionBold,
  PiWifiHighBold,
  PiArrowRightBold,
} from 'react-icons/pi'
import LoadingComp from '../../../components/loader/LoadingComp'
import { getSectionCatalog } from '../../../api/catalog'
import {
  BRIDGE_UTILITY_CARD_TYPES,
  getBridgeServicePresentation,
} from '../../../utils/bridgeCatalogPresentation'

const SERVICE_ICONS = {
  ELECTRICITY: PiLightningBold,
  TV: PiTelevisionBold,
  VTU: PiDeviceMobileBold,
  DATA: PiWifiHighBold,
}

const previewNames = (items) => {
  const names = items
    .map((item) => String(item?.provider || item?.label || '').trim())
    .filter(Boolean)

  return [...new Set(names)].slice(0, 4)
}

const Utility = () => {
  const navigate = useNavigate()
  const [catalogItems, setCatalogItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const loadCatalog = async () => {
      setLoading(true)
      try {
        const response = await getSectionCatalog('bridge')
        if (!active) return
        const items = Array.isArray(response?.data?.data) ? response.data.data : []
        setCatalogItems(items)
      } catch {
        if (!active) return
        setCatalogItems([])
      } finally {
        if (active) setLoading(false)
      }
    }

    loadCatalog()

    return () => {
      active = false
    }
  }, [])

  const serviceCards = useMemo(() => {
    return BRIDGE_UTILITY_CARD_TYPES.map((serviceType) => {
      const config = getBridgeServicePresentation(serviceType)
      const matched = catalogItems.filter(
        (item) => String(item?.service_type || '').toUpperCase() === serviceType
      )

      return {
        key: serviceType,
        title: config?.title || 'Service',
        description: config?.detail || 'Open this active utility service.',
        to: config?.route || '/dashboard/bridge/utilities',
        icon: SERVICE_ICONS[serviceType],
        accent: config?.accent,
        border: config?.border,
        iconWrap: config?.iconWrap,
        button: config?.button,
        preview: previewNames(matched),
        available: matched.length > 0,
      }
    }).filter((item) => item.available)
  }, [catalogItems])

  return (
    <div className="w-full px-4 md:px-6 py-4 space-y-6 text-slate-100">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/85 p-5 md:p-6 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
        <div className="max-w-2xl">
          <h1 className="text-2xl md:text-3xl font-semibold text-white">Utilities</h1>
          <p className="mt-2 text-sm text-slate-400">
            Choose a service to continue. Product-backed utility launchers now come from the backend service catalog.
          </p>
        </div>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          <LoadingComp className="h-32 bg-transparent text-slate-200" />
        </div>
      ) : null}

      {!loading && serviceCards.length === 0 ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-400">
          No active utility services are currently available in the catalog.
        </div>
      ) : null}

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {serviceCards.map((service) => {
          const Icon = service.icon
          return (
            <button
              key={service.key}
              type="button"
              onClick={() => navigate(service.to)}
              className={`group relative overflow-hidden rounded-3xl border ${service.border} bg-slate-900/85 p-5 text-left shadow-[0_16px_32px_rgba(15,23,42,0.18)] transition hover:border-slate-300/25 hover:bg-slate-900`}
            >
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${service.accent}`} />
              <div className="relative">
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${service.iconWrap}`}>
                  <Icon className="text-xl" />
                </div>
                <h2 className="mt-4 text-xl font-semibold text-white">{service.title}</h2>
                <p className="mt-2 text-sm text-slate-400 max-w-md">{service.description}</p>

                {service.preview.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {service.preview.map((name) => (
                      <span
                        key={name}
                        className="rounded-full border border-slate-700 bg-slate-950/35 px-3 py-1 text-xs text-slate-300"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className={`mt-6 inline-flex items-center gap-2 text-sm font-medium ${service.button}`}>
                  Continue
                  <PiArrowRightBold />
                </div>
              </div>
            </button>
          )
        })}
      </section>
    </div>
  )
}

export default Utility