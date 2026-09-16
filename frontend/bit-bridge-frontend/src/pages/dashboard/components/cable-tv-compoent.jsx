import { useEffect, useMemo, useState } from 'react'
import LoadingComp from '../../../components/loader/LoadingComp'
import { getSectionCatalog } from '../../../api/catalog'
import ProductCard from '../../../components/product-card/ProductCard'
import { groupBridgeUtilityCatalog } from '../../../utils/bridgeUtilityCatalog'

const CableTvComponent = () => {
  const [utilities, setUtilities] = useState([])
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
        setUtilities(grouped.utilities)
      } catch {
        if (!active) return
        setUtilities([])
      } finally {
        if (active) setLoading(false)
      }
    }

    loadCatalog()

    return () => {
      active = false
    }
  }, [])

  const cableProviders = useMemo(() => {
    const list = Array.isArray(utilities) ? utilities : []
    return list.filter((item) => item?.service_type === 'TV')
  }, [utilities])

  return (
    <div>
      <section className="py-10 px-4 my-10 bg-black">
        {loading ? (
          <LoadingComp className="bg-transparent text-slate-200" />
        ) : (
          <div className="max-w-7xl text-white m-auto grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {cableProviders.map((item) => (
              <ProductCard
                link={`/dashboard/utilities/cable/${item.id}/cableform`}
                key={item.id}
                id={item.id}
                description={item.product?.description || item.description}
                provider={item.product?.provider || item.name}
                name={item.name}
                isDetails={false}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default CableTvComponent