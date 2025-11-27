import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { getProducts } from '../../../../redux/actions/product'
import SimpleCard from '../../../../components/product-card/SimpleCard'

const PopularCards = () => {
  const dispatch = useDispatch()
  const { giftcards, mobileProviders } = useSelector((state) => state.product)

  useEffect(() => {
    dispatch(getProducts())
  }, [])

  return (
    <section className="py-10 px-4">
      <div className="max-w-7xl m-auto">
        <p className="font-semibold text-blue-600">WHATS TRENDING</p>

        <h2 className="md:text-4xl text-3xl font-semibold ">Popular Offers</h2>
        <p className="font-normal sm:text-xl text-base">
          BitBridge Global has a catalogue of mobile data top ups and recharge vouchers, But below
          are the popular ones
        </p>

        <div className="no-scroll my-10 md:grid flex-nowrap md:grid-cols-4 md:w-full flex-row overflow-x-auto flex w-full bg- gap-3 md:gap-8 ">
          {mobileProviders?.map((item) => (
            <SimpleCard key={item.id} provider={item.provider} id={item.id} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default PopularCards
