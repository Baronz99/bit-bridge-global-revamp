// import serviceProviderData from "../../data/giftCardData.json"
import Header from '../../components/header/Header'

import sellCrypto from '../../assets/images/banners/original-size.webp'
import { useDispatch, useSelector } from 'react-redux'
import { useEffect } from 'react'
import { getProvisions } from '../../redux/actions/provision'
import ProductCard from '../../components/product-card/ProductCard'
const CryptoExchangePage = () => {
  const { giftcards } = useSelector((state) => state.provision)
  const dispatch = useDispatch()
  useEffect(() => {
    dispatch(getProvisions())
  }, [])

  return (
    <div>
      <Header />
      <section className="pt-">
        <div className="max-w-7xl m-auto bg-white p-4 rounded-lg shadow">
          <div className="max-w-7xl bg-white px-4 m-auto border gap-4 p-4 rounded-2xl grid md:grid-cols-2">
            <div>
              <h2 className="text-5xl  font-bold text-gray-700">Sell your crypto with Ease</h2>
              <p className="my-4 text-lg font-medium text-gray-600 text-lef">
                Crypto conversion made easy - conver your crypto to cash in one simple step Pay with
                crypto and stay connected while traveling!
              </p>
            </div>
            <div>
              <div className="h-96">
                <img src={sellCrypto} alt="" className="w-full h-full" />
              </div>
            </div>
          </div>

          <div className=" my-10 m-auto">
            <h3 className="text-lg font-medium">Top Features!</h3>
            <div className="overflow-x-auto">
              <div className="grid w-[400%] sm:w-[200%] md:w-full bg-gray-50 gap-x-3 gap-y-5 md:gap-y-10 grid-cols-4">
                {giftcards.slice(0, 4).map(({ id, product, name, value }) => (
                  <ProductCard
                    link={`/gift-cards/${id}`}
                    key={id}
                    id={id}
                    provider={product.provider}
                    provision={name}
                    value={value}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="py-10 px-4">
        <div className="max-w-7xl m-auto p-4 shadow-sm rounded-lg bg-white">
          <h2 className="text-2xl font-semibold">All gift cards</h2>
          <div className="grid bg-gray-50 gap-x-3 gap-y-5 md:gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {giftcards.map(({ id, product, name, image, value }) => (
              <ProductCard
                link={`/gift-cards/${id}`}
                key={id}
                id={id}
                provider={product?.provider}
                provision={name}
                image={image}
                value={value}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default CryptoExchangePage
