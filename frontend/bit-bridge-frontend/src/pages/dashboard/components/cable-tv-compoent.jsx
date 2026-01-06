import { useDispatch, useSelector } from 'react-redux'
import { useEffect, useMemo } from 'react'
import { getProvisions } from '../../../redux/actions/provision'
import ProductCard from '../../../components/product-card/ProductCard'

const CableTvComponent = () => {
  const dispatch = useDispatch()
  const { utilities } = useSelector((state) => state.provision)

  useEffect(() => {
    dispatch(getProvisions())
  }, [dispatch])

  // ✅ BuyPower vertical is "TV"
  // ✅ Keep legacy support for old "CABLE" records so nothing breaks
  const cableProviders = useMemo(() => {
    const list = Array.isArray(utilities) ? utilities : []
    return list.filter(
      (item) => item?.service_type === 'TV' || item?.service_type === 'CABLE'
    )
  }, [utilities])

  return (
    <div>
      <section className="py-10 px-4 my-10 bg-black">
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
      </section>
    </div>
  )
}

export default CableTvComponent
