import { useEffect, useState } from 'react'
import ElectricCard from '../product-card/ElectricCard'
import { useNavigate } from 'react-router-dom'
import LoadingComp from '../loader/LoadingComp'
import { getSectionCatalog } from '../../api/catalog'
import { groupBridgeUtilityCatalog } from '../../utils/bridgeUtilityCatalog'
import { enrichPowerCatalogItem } from '../../utils/powerCatalog'

const PowerComponent = () => {
  const navigate = useNavigate()
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)

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

  return (
    <section className="py-10  px-4 md:my-10">
      {loading ? (
        <LoadingComp className="bg-transparent text-slate-200" />
      ) : providers.length === 0 ? (
        <div className="max-w-7xl m-auto rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
          Electricity providers are not available right now.
        </div>
      ) : (
        <div className="max-w-7xl text-white m-auto grid grid-cols-2 md:grid-cols-2 gap-4 lg:grid-cols-3">
          {providers.map(({ id, description, name, image }) => (
            <ElectricCard
              onClick={() => navigate(`/dashboard/utilities/buy-power/${id}/powerform`)}
              key={id}
              id={id}
              description={description}
              name={name}
              image={image}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default PowerComponent
