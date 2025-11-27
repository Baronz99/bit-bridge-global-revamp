import Header from '../../components/header/Header'
import scrollToTop from '../../hooks/scrollToTop'
import { useDispatch, useSelector } from 'react-redux'
import { useEffect } from 'react'
import { getProvisions } from '../../redux/actions/provision'
import LoadingComp from '../../components/loader/LoadingComp'
import ProductCard from '../../components/product-card/ProductCard'

const GiftCardPAge = () => {
  const dispatch = useDispatch()
  const { giftcards, loading } = useSelector((state) => state.provision)
  useEffect(() => {
    dispatch(getProvisions())
  }, [])

  scrollToTop()

  return (
    <div className="">
      <Header />

      <section className="py-10 px-4 mt-40">
        <div className=" max-w-7xl px-4 py-10 shadow rounded-lg bg-white m-auto">
          <div className="">
            <h3 className="text-lg font-medium text-gray-800">Top Features!</h3>

            <div className="overflow-x-auto">
              {loading ? (
                <LoadingComp />
              ) : (
                <div className="grid w-[400%] sm:w-[200%] md:w-full bg-gray-50 gap-x-3 gap-y-5 md:gap-y-10 grid-cols-4">
                  {giftcards.slice(0, 4).map(({ id, product, name, image, value }) => (
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
              )}
            </div>
          </div>

          <div className="max-w-7xl py-10 m-auto">
            <h2 className="text-2xl font-semibold">All gift cards</h2>
            <div className="grid bg-gray-50 gap-x-3 gap-y-20 grid-cols-2 md:grid-cols-3 ">
              {giftcards.map(({ id, product, currency, name, image, min_value, max_value }) => (
                <ProductCard
                  key={id}
                  id={id}
                  provider={product?.provider}
                  currency={currency}
                  provision={name}
                  image={image}
                  min_value={min_value}
                  max_value={max_value}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default GiftCardPAge
