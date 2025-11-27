import { useParams } from 'react-router-dom'
import Header from '../../components/header/Header'
import { useDispatch, useSelector } from 'react-redux'

import { useEffect } from 'react'
import { splitString } from '../../utils'
import { getProvisions } from '../../redux/actions/provision'

import ProductCard from '../../components/product-card/ProductCard'

const ProductView = () => {
  const dispatch = useDispatch()

  const { id } = useParams()

  const { products } = useSelector((state) => state.product)

  const selectedProvider = [...products]?.find((item) => item.id == id)
  const serviceImage = splitString(selectedProvider?.provider)

  useEffect(() => {
    dispatch(getProvisions())
  }, [])

  return (
    <div>
      <Header />
      <section className="px-4">
        <div className="grid lg:grid-cols-2 gap-10 max-w-6xl m-auto py-10">
          <div className="p-10 bg-gray-200 flex justify-center items-center h-96">
            <img
              src={`/images/providers/${serviceImage}.webp`}
              className="h-full"
              alt="provider image"
            />
          </div>
          <div>
            <div className="text-sm my-2 text-gray-600 font-medium">
              <p className="capitalize">
                {' '}
                {selectedProvider?.category} &gt; {selectedProvider?.provider}
              </p>
            </div>

            <h3 className="text-2xl font-medium">{selectedProvider?.name}</h3>

            <div className="notice rounded-xl my-2">
              <p className="text-sm text-gray-700">{selectedProvider?.info}</p>
            </div>
            <p className="my-3">{selectedProvider?.header_info}</p>

            <div>
              <h3 className="text-2xl my-6 font-medium"> Description </h3>

              <div dangerouslySetInnerHTML={{ __html: selectedProvider?.product?.description }} />
            </div>
          </div>
        </div>
        <div className="max-w-7xl m-auto bg-red-40">
          <h2 className="text-xl text-gray-800 my-4">
            More Products on{' '}
            <span className="font-medium uppercase">{selectedProvider?.provider}</span>{' '}
          </h2>
          <div className="grid sm:grid-cols-4 gap-3">
            {selectedProvider?.provisions.map(({ id, min_value, max_value, name, currency }) => (
              <ProductCard
                link={`/phone-top-up/${id}`}
                key={id}
                id={id}
                min_value={min_value}
                currency={currency}
                max_value={max_value}
                provider={name}
                provision={name}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 bg-gray-200 py-10"></section>
      <section className="px-4 py-20">
        <h2 className="text-3xl font-semibold">How gift card work</h2>
        <div></div>
      </section>
    </div>
  )
}

export default ProductView
