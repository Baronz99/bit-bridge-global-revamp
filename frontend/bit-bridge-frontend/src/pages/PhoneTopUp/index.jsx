import Header from '../../components/header/Header'
import ProductCard from '../../components/product-card/ProductCard'
import { useDispatch, useSelector } from 'react-redux'
import { useEffect } from 'react'
import { getProvisions } from '../../redux/actions/provision'
import LoadingComp from '../../components/loader/LoadingComp'
const PhoneTopUp = () => {
  // const navigate = useNavigate()
  const dispatch = useDispatch()
  const { dataBundles, loading, airtime } = useSelector((state) => state.provision)
  useEffect(() => {
    dispatch(getProvisions())
  }, [])

  return (
    <div>
      <Header />

      <div className="h-[500px] px-4 bg-gray-900 flex justify-center items-center">
        <h2 className="sm:text-4xl text-2xl max-w-5xl font-semibold text-center text-white">
          Top up prepaid mobile data from anywhere in the world
        </h2>
      </div>

      <section className="py-10 px-4 ">
        <div className="max-w-7xl m-auto p-4 bg-white">
          <h3 className="font-medium text-xl">Data Bundle</h3>

          {loading ? (
            <LoadingComp />
          ) : dataBundles.length > 0 ? (
            <div className="grid bg-white py-4 rounded-lg gap-4 gap-y-7 grid-cols-2 md:grid-cols-3 max-w-7xl m-auto">
              {dataBundles?.map(({ id, product, name, min_value, currency, max_value }) => (
                <ProductCard
                  key={id}
                  // link={`/phone-top-up/${id}`}
                  link={`/dashboard/home`}
                  id={id}
                  min_value={min_value}
                  currency={currency}
                  max_value={max_value}
                  provider={product?.provider}
                  provision={name}
                />
              ))}
            </div>
          ) : (
            <div className="text-center font-medium">
              <h3 className="text-3xl my-6">
                NO UTILITY AVAILABLE <br /> PLEASE ADD SOME PROVISION IF YOU ARE THE ADMIN{' '}
              </h3>
            </div>
          )}
        </div>
      </section>
      <section className="py-10 px-4">
        <div className="max-w-7xl m-auto bg-white p-4">
          <h3 className="font-medium text-xl">Airtime Recharge</h3>

          {airtime.length > 0 ? (
            <div className="grid bg-white py-4 rounded-lg gap-4 gap-y-7 grid-cols-2 md:grid-cols-3 max-w-7xl m-auto">
              {airtime?.map(({ id, product, name, min_value, currency, max_value }) => (
                <ProductCard
                  key={id}
                  link={`/dashboard/home`}
                  // link={`/phone-top-up/${id}`}
                  id={id}
                  min_value={min_value}
                  currency={currency}
                  max_value={max_value}
                  provider={product?.provider}
                  provision={name}
                />
              ))}
            </div>
          ) : (
            <div className="text-center font-medium">
              <h3 className="text-3xl my-6">
                NO UTILITY AVAILABLE <br /> PLEASE ADD SOME PROVISION IF YOU ARE THE ADMIN{' '}
              </h3>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default PhoneTopUp
