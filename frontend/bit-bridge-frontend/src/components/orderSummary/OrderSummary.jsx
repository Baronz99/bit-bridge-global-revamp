import { DeleteTwoTone } from '@ant-design/icons'
import { useDispatch } from 'react-redux'
import { nairaFormat } from '../../utils/nairaFormat'
import { DELETE_CART } from '../../redux/app'
import { splitString } from '../../utils'
import PropTypes from 'prop-types'
import { useEffect, useState } from 'react'
import { converter } from '../../api/currencyConverter'
import { CgArrowsExchangeAlt } from 'react-icons/cg'

const OrderSummary = ({ cartItems, VAT, netAmount, convertedTotal }) => {
  const dispatch = useDispatch()
  const [conversions, setConversion] = useState()

  const _VAT = VAT ?? convertedTotal * (10 / 100)
  const _netAmount = netAmount ?? _VAT + convertedTotal

  const handleConversion = async (fromCurr, toCurr, amount) => {
    const newvalue = await converter({ fromCurr, toCurr, amount })

    return newvalue?.calc
  }

  useEffect(() => {
    ;(async () => {
      const _cartItems = await Promise.all(
        cartItems.map(async (item) => ({
          ...item,
          usdConversion: await handleConversion(
            item?.currency ?? item?.provision?.currency,
            'usd',
            item?.amount
          ),
        }))
      )

      setConversion(_cartItems)
    })()
  }, [cartItems])

  return (
    <div className="bg-white p-4">
      <h3 className="text-2xl mb-10 font-semibold">Order Summary</h3>

      {conversions?.map((item) => (
        <div key={item?.id} className="flex my-3 gap-4">
          <div className="w-16 h-16 md:w-24 shrink-0 md:h-24 border rounded">
            <img
              src={`/images/providers/${splitString(item?.provider ?? item?.product?.provider)}.webp`}
              className="w-full h-full object-contain"
              alt={item.provider}
            />
          </div>
          <div className="flex-1">
            <p className="text-base font-semibold">{item?.product?.provider}</p>
            <p className="text-base font-semibold">{item?.provision?.name}</p>
            <p className="font-semibold font-semd text-gray-700">
              {nairaFormat(item?.amount, item?.currency ?? item?.provision?.currency)}
            </p>

            <div className="font-medium text-gray-700 px-2 text-center">
              {' '}
              <CgArrowsExchangeAlt className="m-" />{' '}
            </div>
            <p className="font-medium  text-gray-700">{nairaFormat(item?.usdConversion, 'usd')}</p>
          </div>
          <div className="">
            <div className="flex gap-4">
              <p>{item?.quantity ?? 1}</p>
              <span onClick={() => dispatch(DELETE_CART(item?.provision_id))}>
                <DeleteTwoTone />
              </span>
            </div>
          </div>
        </div>
      ))}

      <div className="flex justify-between my-2 border-t py-5">
        <span className="text-base font-semibold text-gray-900 ">Total</span>
        <span className="font-semibold text-lg">
          {/* {nairaFormat(totalAmount, "usd")} */}
          {nairaFormat(convertedTotal, 'usd')}
        </span>
      </div>

      <div className="flex justify-between my-2 py-1">
        <span className="text-base font-semibold text-gray-900 ">VAT</span>
        <span className="font-semibold text-lg">{nairaFormat(_VAT, 'usd')}</span>
      </div>

      <div className="flex justify-between my-2 border-t py-5">
        <span className="text-base font-semibold text-gray-900 ">NET TOTAL</span>
        <span className="font-semibold text-lg">{nairaFormat(_netAmount, 'usd')}</span>
      </div>
    </div>
  )
}

OrderSummary.propTypes = {
  cartItems: PropTypes.array,
  totalAmount: PropTypes.number,
  convertedTotal: PropTypes.number,
  VAT: PropTypes.number,
  netAmount: PropTypes.number,
}

export default OrderSummary
