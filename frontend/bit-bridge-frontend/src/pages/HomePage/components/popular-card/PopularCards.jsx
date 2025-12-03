import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { getProducts } from '../../../../redux/actions/product'
import SimpleCard from '../../../../components/product-card/SimpleCard'

const PopularCards = () => {
  const dispatch = useDispatch()
  const { giftcards, mobileProviders } = useSelector((state) => state.product)

  useEffect(() => {
    dispatch(getProducts())
  }, [dispatch])

  return (
    <section className="py-10 px-4 bg-white">
      <div className="max-w-7xl m-auto">
        <p className="font-semibold text-blue-600 text-xs tracking-[0.25em] uppercase">
          Real usage today
        </p>

        <h2 className="md:text-4xl text-3xl font-semibold mt-2">
          Popular BitBridge payment flows
        </h2>
        <p className="font-normal sm:text-lg text-sm text-gray-600 max-w-2xl mt-2">
          Most people start with airtime, data and utilities — the everyday rails their money
          already runs on. As we expand shared wallets and payment accounts, these flows stay at
          the center of the experience.
        </p>

        <div className="no-scroll my-10 md:grid flex-nowrap md:grid-cols-4 md:w-full flex-row overflow-x-auto gap-3 md:gap-6">
          {mobileProviders?.map((item) => (
            <SimpleCard key={item.id} provider={item.provider} id={item.id} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default PopularCards
