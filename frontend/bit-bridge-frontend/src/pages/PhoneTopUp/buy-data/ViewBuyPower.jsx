import { Outlet, useParams } from 'react-router-dom'
import Header from '../../../compnents/header/Header'
import ProductCard from '../../../compnents/product-card/ProductCard'

import { useDispatch, useSelector } from 'react-redux'

import { useEffect } from 'react'
import powerDistributions from '../../../data/powerDistributions.json'
import { getProvisions } from '../../../redux/actions/provision'
import ElectricCard from '../../../compnents/product-card/ElectricCard'

const ViewBuyData = () => {
  const dispatch = useDispatch()
  const { id } = useParams()

  const { mobileProviders } = useSelector((state) => state.provision)

  const selectedProvider = powerDistributions?.find((item) => item.id == id)

  useEffect(() => {
    dispatch(getProvisions())
  }, [])

  return (
    <div>
      <Header />
      <section className="px-4 py-10">
        <div className="max-w-7xl bg-white m-auto py-10 px-4 md:px-10">
          <div className="flex sm:flex-row flex-col  gap-3">
            <img src={selectedProvider?.image} alt="" className="max-w-40" />
            <div>
              <div>
                <p className="text-3xl text-gray-800 my-4 font-semibold ">
                  {selectedProvider?.name}
                </p>
                <p className="text-lg text-gray-700">{selectedProvider?.description}</p>
              </div>

              <div className="my-4">
                <p className="text-base text-gray-600 my-0 ">{selectedProvider?.name}</p>
                <p className="text-base text-gray-600">{selectedProvider?.description}</p>
              </div>
            </div>
          </div>
          {/* {selectSlide(step)} */}
          <Outlet context={[id, selectedProvider?.biller]} />
        </div>
      </section>

      <section className="py-10 px-4 my-10 bg-white">
        <div className="max-w-7xl m-auto grid md:grid-cols-3 gap-10">
          {powerDistributions.map(({ id, description, name, image }) => (
            <ElectricCard key={id} id={id} description={description} name={name} image={image} />
          ))}
        </div>
      </section>

      <section className="px-4 bg-gray-200 py-10">
        <div className="max-w-7xl m-auto bg-red-40">
          <h2 className="text-2xl my-4">More Products on BitBridge</h2>
          <div className="grid sm:grid-cols-4 gap-3">
            {mobileProviders.map(({ id, provider, currency, name, max_value, min_value }) => (
              <ProductCard
                link={`/phone-top-up/${id}`}
                key={id}
                id={id}
                provider={provider}
                currency={currency}
                max_value={max_value}
                min_value={min_value}
                provision={name}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default ViewBuyData
