import { Outlet, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getSectionCatalog } from '../../../../api/catalog'
import { groupBridgeUtilityCatalog } from '../../../../utils/bridgeUtilityCatalog'
import { enrichPowerCatalogItem } from '../../../../utils/powerCatalog'
import LoadingComp from '../../../../components/loader/LoadingComp'

const PowerView = () => {
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const { id } = useParams()

  useEffect(() => {
    let active = true

    const loadCatalog = async () => {
      setLoading(true)
      try {
        const response = await getSectionCatalog('bridge')
        if (!active) return
        const items = Array.isArray(response?.data?.data) ? response.data.data : []
        const grouped = groupBridgeUtilityCatalog(items)
        const electricityProviders = grouped.utilities
          .filter((item) => item.service_type === 'ELECTRICITY')
          .map(enrichPowerCatalogItem)
        setProviders(electricityProviders)
      } catch {
        if (!active) return
        setProviders([])
      } finally {
        if (active) setLoading(false)
      }
    }

    loadCatalog()

    return () => {
      active = false
    }
  }, [])

  const selectedProvider = providers?.find((item) => String(item.id) === String(id))
  const service = 'buy-power'

  if (loading) {
    return (
      <section className="px-4 md:py-10">
        <div className="max-w-7xl text-white m-auto py-10 px-0 md:px-10">
          <LoadingComp className="bg-transparent text-slate-200" />
        </div>
      </section>
    )
  }

  if (!selectedProvider) {
    return (
      <section className="px-4 md:py-10">
        <div className="max-w-7xl text-white m-auto py-10 px-0 md:px-10">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
            This electricity provider is not available in the current service catalog.
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="px-4  md:py-10">
      <div className="max-w-7xl text-white m-auto py-10 px-0 md:px-10">
        <div className="flex sm:flex-row flex-col  gap-3">
          <img
            src={selectedProvider?.image}
            alt={selectedProvider?.name}
            className="md:h-52 h-40 w-full  sm:max-w-80 rounded-lg border border-alt p-2"
          />
          <div>
            <div>
              <p className="text-3xl text-gray-200 my-4 font-semibold ">{selectedProvider?.name}</p>
              <p className="text-lg text-gray-300">{selectedProvider?.description}</p>
            </div>

            <div className="my-4">
              <p className="text-base text-gray-400 my-0 ">{selectedProvider?.name}</p>
              <p className="text-base text-gray-400">{selectedProvider?.description}</p>
            </div>
          </div>
        </div>

        <Outlet context={[id, selectedProvider, service]} />
      </div>
    </section>
  )
}

export default PowerView
