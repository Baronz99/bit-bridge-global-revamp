import { useParams } from 'react-router-dom'
import Header from '../../components/header/Header'
import ProductCard from '../../components/product-card/ProductCard'
import CartButton from '../../components/button/CartButton'
import { ExclamationOutlined } from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import { ADD_TO_CART } from '../../redux/app'
import { useEffect, useState } from 'react'
import { converter } from '../../api/currencyConverter'
import FormSelect from '../../components/formSelect/FormSelect'
import { getProvisions } from '../../redux/actions/provision'
import { splitString } from '../../utils'
import selectCurrencyOptions from '../../utils/selectCurrencyOption'

const ViewGiftCard = () => {
  const dispatch = useDispatch()
  const { id } = useParams()
  const [value, setValue] = useState(0)
  const { giftcards, mobileProviders } = useSelector((state) => state.provision)
  const [btcValue, setBtcValue] = useState()

  const selectedProvider = giftcards?.find((item) => item.id == id)

  const giftcardImage = splitString(selectedProvider?.product?.provider)

  useEffect(() => {
    dispatch(getProvisions())
  }, [])

  const handleCart = () => {
    if (!value) {
      console.error('Value is required and cannot be empty.')

      return
    }

    dispatch(
      ADD_TO_CART({
        provision_id: selectedProvider.id,
        product_id: selectedProvider.product.id,
        provision: selectedProvider.name,
        provider: selectedProvider.product.provider,
        image: selectedProvider.product.provider,
        amount: value,
        currency: selectedProvider.currency,
      })
    )
  }

  useEffect(() => {
    const fetchBtcValue = async () => {
      try {
        const btcValueFig = await converter({ fromCurr: 'usd', amount: value, toCurr: 'btc' })
        setBtcValue(btcValueFig)
      } catch (error) {
        console.error('Error fetching BTC value:', error.message)
      }
    }

    fetchBtcValue()
  }, [value])

  return (
    <div>
      <Header />
      <section className="px-4">
        <div className="grid lg:grid-cols-2 gap-10 max-w-6xl m-auto py-10">
          <div className="p-10 bg-gray-200 flex justify-center items-center h-96">
            <img
              src={`/images/providers/${giftcardImage}.webp`}
              className="h-full"
              alt="provider image"
            />
          </div>
          <div>
            <div className="text-sm my-2 text-gray-600 font-medium">
              <p>Gift Card &gt; {selectedProvider?.product?.provider}</p>
            </div>

            <h3 className="text-2xl font-medium">{selectedProvider?.name}</h3>

            <div className="notice rounded-xl my-2">
              <p className="text-sm text-gray-700">{selectedProvider?.product?.info}</p>
            </div>
            <p className="my-3">{selectedProvider?.product?.header_info}</p>
            <div>
              <h3 className="text-xl font-semibold">Enter Amount </h3>

              <div className="flex flex-col gap-0">
                <FormSelect
                  type="nubmer"
                  value={value}
                  onChange={(input) => {
                    setValue(input)
                  }}
                  placeholder={'Enter Value'}
                  options={selectCurrencyOptions(selectedProvider?.currency)}
                  className={'whiteBg'}
                />

                <div className="flex-1 text-sm mt-2 from-gray-800">
                  Estimated price {btcValue?.calc}BTC
                </div>
              </div>
            </div>

            <div>
              <div className="my-3">
                <CartButton onClick={() => handleCart(selectedProvider)}>Add To Cart</CartButton>
              </div>

              {/* <div className="my-4">
                        <label htmlFor="phone_no my-2">Number to Top-Up</label>
                        <input className="p-4 block border w-full rounded" placeholder="0801230456 7890"/>
                    </div> */}
            </div>
            <div className="bg-gray-600 flex items-center gap-3 rounded-lg text-white p-4">
              <span className="border rounded-full flex justify-center shrink-0">
                <ExclamationOutlined />
              </span>
              <p className="text-sm font-medium">We are currently out of stock on this product</p>
            </div>
            <div>
              <h3 className="text-2xl my-6 font-medium"> Description </h3>

              <div dangerouslySetInnerHTML={{ __html: selectedProvider?.product?.description }} />
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 bg-gray-200 py-10">
        <div className="max-w-7xl m-auto bg-red-40">
          <h2 className="text-2xl my-4">More Products on BitBridge</h2>
          <div className="grid sm:grid-cols-4 gap-3">
            {mobileProviders.map(({ id, product, min_value, max_value, currency, name }) => (
              <ProductCard
                key={id}
                id={id}
                min_value={min_value}
                currency={currency}
                max_value={max_value}
                provider={product.provider}
                provision={name}
              />
            ))}
          </div>
        </div>
      </section>
      <section className="px-4 py-20">
        <h2 className="text-3xl font-semibold">How gift card work</h2>
        <div></div>
      </section>
    </div>
  )
}

export default ViewGiftCard
