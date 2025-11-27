import Header from '../../components/header/Header'
import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import img from '../../assets/images/banners/buy-power.jpg'
import { useNavigate } from 'react-router-dom'

import LoadingComp from '../../components/loader/LoadingComp'
import { getProvisions } from '../../redux/actions/provision'
import ProductCard from '../../components/product-card/ProductCard'

const MainServices = () => {
  const dispatch = useDispatch()

  const { utilities, loading } = useSelector((state) => state.provision)
  useEffect(() => {
    dispatch(getProvisions())
  }, [])
  const navigate = useNavigate()

  return (
    <div>
      <Header />
      <section className="py-10 mt-28 md:mt-32">
        <div className="max-w-7xl m-auto border gap-4 p-4 rounded-2xl grid md:grid-cols-2">
          <div>
            <h2
              onClick={() => navigate('/buy-power')}
              className="text-5xl hover:text-blue-900 cursor-pointer font-bold text-gray-700 leading-tight"
            >
              Purchase Electricity with your wallet with ease
            </h2>
            <p className="my-4 text-lg font-medium text-gray-600 text-lef">
              Crypto conversion made easy - conver your crypto to cash in one simple step Pay with
              crypto and stay connected while traveling!
            </p>
          </div>
          <div>
            <div className="h-96">
              <img src={img} alt="" className="w-full h-full rounded-lg" />
            </div>
          </div>
        </div>
      </section>

      <section className="py-10 bg-white px-4">
        <div className="max-w-7xl m-auto p-4 bg-white">
          <h3 className="font-medium text-xl">Utilities</h3>

          {loading ? (
            <LoadingComp />
          ) : utilities.length > 0 ? (
            <div className="grid max-w-7xl p-4 m-auto  gap-x-3 gap-y-5 md:gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {utilities.map(({ id, value, product, image }) => (
                <ProductCard
                  link={`/utility-services/${id}`}
                  valueRange={false}
                  key={id}
                  id={id}
                  linkTo={`utility-services`}
                  image={image}
                  value={value}
                  provider={product?.provider}
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

export default MainServices
